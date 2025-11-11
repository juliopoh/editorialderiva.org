const faunadb = require("faunadb")
const q = faunadb.query

// Fail fast with a clear error if the Fauna admin key is not provided
if (!process.env.FAUNA_ADMIN_KEY) {
  const msg = "Missing FAUNA_ADMIN_KEY environment variable. Set FAUNA_ADMIN_KEY to a valid FaunaDB admin key."
  console.error(msg)
  throw new Error(msg)
}

const serverClient = new faunadb.Client({ secret: process.env.FAUNA_ADMIN_KEY })

async function storePayment(data) {
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
  try {
    const success = await serverClient.query(q.Get(q.Match(q.Index("payment_by_token"), token)))
    return success
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function updatePayment(id, data) {
  try {
    const success = await serverClient.query(q.Update(q.Ref(q.Collection("payments"), id), { data }))
    return success
  } catch (err) {
    console.error(err)
    throw err
  }
}

module.exports = { storePayment, retrievePayment, updatePayment }
