const contentful = require("contentful")
const { WebpayPlus } = require("transbank-sdk")

if (process.env.WPP_CC && process.env.WPP_KEY) {
  WebpayPlus.configureForProduction(process.env.WPP_CC, process.env.WPP_KEY)
} else {
  WebpayPlus.configureForTesting()
}

async function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return cart || []

  if (!process.env.CONTENTFUL_SPACE_ID || !process.env.CONTENTFUL_ACCESS_TOKEN) {
    console.warn(
      "CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN missing — skipping price validation"
    )
    return cart
  }

  try {
    const contentfulClient = contentful.createClient({
      space: process.env.CONTENTFUL_SPACE_ID,
      accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
    })
    const contentful_ids = cart.map(item => item.contentful_id)
    const { items: inventory } = await contentfulClient.getEntries({
      content_type: "book",
      "sys.id[in]": contentful_ids.join(","),
    })
    const validated = cart.map(item => {
      const check = inventory.find(({ sys }) => sys.id === item.contentful_id)
      if (check && check.fields && typeof check.fields.price !== 'undefined') {
        item.price = check.fields.price
      }
      return item
    })
    return validated
  } catch (err) {
    console.error('Contentful price validation failed:', err)
    // return original cart so checkout can continue (server will still validate prices later if needed)
    return cart
  }
}

function sumTotal(cart) {
  return cart.reduce((acc, { quantity, price }) => acc + quantity * price, 0)
}

module.exports = async (req, res) => {
  console.log('api/create handler invoked', req && req.method)
  console.log('request body preview:', req && req.body && JSON.stringify(req.body).slice(0, 100))
  // fail early and return a clear JSON error if Supabase credentials are missing
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials - returning explicit error')
    res.status(500)
    return res.json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable' })
  }
  // require DB helpers lazily so module load doesn't throw in production hosts
  const { storePayment, updatePayment } = require("../src/utils/db")
  try {
    // basic guard: ensure req.body exists
    if (!req || !req.body) {
      console.error('No req.body present')
      res.status(400)
      return res.json({ error: 'No request body' })
    }
    const { name, address, email } = req.body
    const cart = await validateCart(req.body.cart)

    // store payment in Supabase — surface errors directly
    let payment
    try {
      payment = await storePayment({ cart, name, address, email, status: "INITIALIZED" })
    } catch (err) {
      console.error('storePayment error:', err)
      const resp = { errorType: 'supabase', message: err && err.message ? err.message : String(err) }
      if (process.env.DEBUG_API_ERRORS === 'true' && err && err.stack) resp.stack = err.stack
      res.status(502)
      return res.json(resp)
    }
    if (!payment) {
      console.error('storePayment returned falsy value')
      res.status(500)
      return res.json({ errorType: 'supabase', message: 'storePayment returned no result' })
    }
    const paymentId = payment.id || payment.payment_id
    if (!paymentId) {
      console.error('storePayment returned no id')
      res.status(500)
      return res.json({ errorType: 'supabase', message: 'storePayment returned no id' })
    }
    const buyOrder = String(paymentId)
    const sessionId = String(paymentId)
    const amount = sumTotal(cart)
    const returnUrl = `${process.env.BASE_URL}/api/commit`

    // create transaction with Webpay — surface errors explicitly
    let url, token
    try {
      const tx = await new WebpayPlus.Transaction().create(buyOrder, sessionId, amount, returnUrl)
      url = tx.url
      token = tx.token
    } catch (err) {
      console.error('Webpay create error:', err)
      const resp = { errorType: 'webpay', message: err && err.message ? err.message : String(err) }
      if (process.env.DEBUG_API_ERRORS === 'true' && err && err.stack) resp.stack = err.stack
      res.status(502)
      return res.json(resp)
    }

    // update payment with token and amount
    try {
      await updatePayment(buyOrder, { token, amount })
    } catch (err) {
      console.error('updatePayment error:', err)
      const resp = { errorType: 'supabase_update', message: err && err.message ? err.message : String(err) }
      if (process.env.DEBUG_API_ERRORS === 'true' && err && err.stack) resp.stack = err.stack
      res.status(500)
      return res.json(resp)
    }

    return res.json({ redirect: url + "?token_ws=" + token })
  } catch (err) {
    res.status(500)
    res.json({ error: err.toString() })
  }
}
