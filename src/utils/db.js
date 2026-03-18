const { createClient } = require("@supabase/supabase-js")

const HAS_SUPABASE = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
)
let supabase = null
if (HAS_SUPABASE) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
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
  const { data: row, error } = await runWithRetry("storePayment", () =>
    client.from("payments").insert([{ ...data }]).select().single()
  )
  if (error) {
    console.error(error)
    throw error
  }
  return row
}

async function retrievePayment(token) {
  const client = ensureSupabase()
  const { data: row, error } = await runWithRetry("retrievePayment", () =>
    client.from("payments").select("*").eq("token", token).single()
  )
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
    const { data: rowById, error: errById } = await runWithRetry(
      "updatePaymentById",
      () =>
        client
          .from("payments")
          .update({ ...data })
          .eq("id", normalizedId)
          .select()
          .maybeSingle()
    )
    if (errById) {
      console.error(errById)
      throw errById
    }
    if (rowById) return rowById
  }

  const { data: rowByOrder, error: errByOrder } = await runWithRetry(
    "updatePaymentByOrder",
    () =>
      client
        .from("payments")
        .update({ ...data })
        .eq("buy_order", String(identifier))
        .select()
        .maybeSingle()
  )
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
