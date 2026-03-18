const https = require("node:https")
const { createClient } = require("@supabase/supabase-js")

function cleanEnv(value) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL)
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

const HAS_SUPABASE = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
)
let supabase = null
if (HAS_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
} else {
  console.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not present. DB calls will throw a clear error when invoked."
  )
}

function ensureSupabase() {
  if (!HAS_SUPABASE || !supabase) {
    const msg =
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable. Cannot access payments."
    console.error(msg)
    throw new Error(msg)
  }
  return supabase
}

function normalizeId(id) {
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return Number(id)
  }
  return id
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getErrorCode(error) {
  if (!error || !error.cause || !error.cause.code) return ""
  return String(error.cause.code).toUpperCase()
}

function isRetriableFetchError(error) {
  const message = (error && error.message ? String(error.message) : "").toLowerCase()
  const code = getErrorCode(error)
  return (
    message.includes("fetch failed") ||
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH", "ECONNREFUSED"].includes(code)
  )
}

function extractSupabaseErrorBody(rawBody) {
  if (!rawBody) return null
  try {
    return JSON.parse(rawBody)
  } catch (error) {
    return { raw: rawBody }
  }
}

function supabaseRestRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!HAS_SUPABASE) {
      reject(
        new Error(
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable. Cannot access payments."
        )
      )
      return
    }

    const url = new URL(path, SUPABASE_URL)
    const payload = typeof body === "undefined" ? null : JSON.stringify(body)
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    }

    if (payload !== null) {
      headers["Content-Type"] = "application/json"
      headers["Content-Length"] = String(Buffer.byteLength(payload))
    }

    if (method !== "GET") {
      headers.Prefer = "return=representation"
    }

    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        headers,
      },
      res => {
        let chunks = ""
        res.on("data", chunk => {
          chunks += chunk
        })
        res.on("end", () => {
          const parsed = extractSupabaseErrorBody(chunks)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
            return
          }
          const error = new Error(
            `Supabase REST ${method} failed with status ${res.statusCode}`
          )
          error.statusCode = res.statusCode
          error.details = parsed
          reject(error)
        })
      }
    )

    req.on("error", reject)
    if (payload !== null) {
      req.write(payload)
    }
    req.end()
  })
}

async function storePaymentViaRest(data) {
  const rows = await supabaseRestRequest("POST", "/rest/v1/payments?select=*", [
    { ...data },
  ])
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Supabase REST insert returned no row.")
  }
  return rows[0]
}

async function retrievePaymentViaRest(token) {
  const params = new URLSearchParams()
  params.set("token", `eq.${String(token)}`)
  params.set("select", "*")
  params.set("limit", "1")
  const rows = await supabaseRestRequest("GET", `/rest/v1/payments?${params.toString()}`)
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Payment not found.")
  }
  return rows[0]
}

async function updatePaymentViaRest(field, value, data) {
  const params = new URLSearchParams()
  params.set(field, `eq.${String(value)}`)
  params.set("select", "*")
  params.set("limit", "1")
  const rows = await supabaseRestRequest(
    "PATCH",
    `/rest/v1/payments?${params.toString()}`,
    { ...data }
  )
  if (!Array.isArray(rows) || !rows[0]) return null
  return rows[0]
}

async function runWithRetry(operation, fn, attempts = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const shouldRetry = isRetriableFetchError(error) && attempt < attempts
      if (!shouldRetry) {
        console.error(`${operation} failed`, {
          attempt,
          code: getErrorCode(error),
          message: error && error.message ? error.message : String(error),
        })
        throw error
      }
      await sleep(attempt * 150)
    }
  }

  throw lastError
}

async function storePayment(data) {
  const client = ensureSupabase()
  let result
  try {
    result = await runWithRetry("storePayment", () =>
      client.from("payments").insert([{ ...data }]).select().single()
    )
  } catch (error) {
    if (!isRetriableFetchError(error)) throw error
    console.warn("storePayment falling back to Supabase REST")
    return storePaymentViaRest(data)
  }

  const { data: row, error } = result
  if (error) {
    console.error(error)
    throw error
  }
  return row
}

async function retrievePayment(token) {
  const client = ensureSupabase()
  let result
  try {
    result = await runWithRetry("retrievePayment", () =>
      client.from("payments").select("*").eq("token", token).single()
    )
  } catch (error) {
    if (!isRetriableFetchError(error)) throw error
    console.warn("retrievePayment falling back to Supabase REST")
    return retrievePaymentViaRest(token)
  }

  const { data: row, error } = result
  if (error) {
    console.error(error)
    throw error
  }
  return row
}

async function updatePayment(identifier, data) {
  const client = ensureSupabase()
  const normalizedId = normalizeId(identifier)

  if (typeof normalizedId === "number") {
    let rowById
    let errById
    try {
      const resultById = await runWithRetry("updatePaymentById", () =>
        client
          .from("payments")
          .update({ ...data })
          .eq("id", normalizedId)
          .select()
          .maybeSingle()
      )
      rowById = resultById.data
      errById = resultById.error
    } catch (error) {
      if (!isRetriableFetchError(error)) throw error
      console.warn("updatePaymentById falling back to Supabase REST")
      rowById = await updatePaymentViaRest("id", normalizedId, data)
    }
    if (errById) {
      console.error(errById)
      throw errById
    }
    if (rowById) return rowById
  }

  let rowByOrder
  let errByOrder
  try {
    const resultByOrder = await runWithRetry("updatePaymentByOrder", () =>
      client
        .from("payments")
        .update({ ...data })
        .eq("buy_order", String(identifier))
        .select()
        .maybeSingle()
    )
    rowByOrder = resultByOrder.data
    errByOrder = resultByOrder.error
  } catch (error) {
    if (!isRetriableFetchError(error)) throw error
    console.warn("updatePaymentByOrder falling back to Supabase REST")
    rowByOrder = await updatePaymentViaRest("buy_order", String(identifier), data)
  }
  if (errByOrder) {
    console.error(errByOrder)
    throw errByOrder
  }
  if (!rowByOrder) {
    const msg = "Payment not found for update."
    console.error(msg)
    throw new Error(msg)
  }
  return rowByOrder
}

module.exports = { storePayment, retrievePayment, updatePayment }
