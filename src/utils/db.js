const faunadb = require("faunadb")
const q = faunadb.query

// Don't throw at module-load time in production hosts. Instead, create the
// client only when a key is present and fail with a clear error when DB
// helpers are actually called without credentials.
const HAS_FAUNA = Boolean(process.env.FAUNA_ADMIN_KEY)
let serverClient = null
if (HAS_FAUNA) {
  serverClient = new faunadb.Client({ secret: process.env.FAUNA_ADMIN_KEY })
} else {
  console.warn(
    "FAUNA_ADMIN_KEY not present. DB calls will throw a clear error when invoked."
  )
}

async function storePayment(data) {
  if (!HAS_FAUNA || !serverClient) {
    const msg = "Missing FAUNA_ADMIN_KEY environment variable. Cannot store payment."
    console.error(msg)
    throw new Error(msg)
  }
  try {
    const success = await serverClient.query(q.Create(q.Collection("payments"), { data }))
    return success
  } catch (err) {
    console.error(err)
    // rethrow so callers don't continue with undefined results
    throw err
  }
}

async function retrievePayment(token) {
  if (!HAS_FAUNA || !serverClient) {
    const msg = "Missing FAUNA_ADMIN_KEY environment variable. Cannot retrieve payment."
    console.error(msg)
    throw new Error(msg)
  }
  try {
    const success = await serverClient.query(q.Get(q.Match(q.Index("payment_by_token"), token)))
    return success
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function updatePayment(id, data) {
  if (!HAS_FAUNA || !serverClient) {
    const msg = "Missing FAUNA_ADMIN_KEY environment variable. Cannot update payment."
    console.error(msg)
    throw new Error(msg)
  }
  try {
    const success = await serverClient.query(q.Update(q.Ref(q.Collection("payments"), id), { data }))
    return success
  } catch (err) {
    console.error(err)
    throw err
  }
}

module.exports = { storePayment, retrievePayment, updatePayment }
