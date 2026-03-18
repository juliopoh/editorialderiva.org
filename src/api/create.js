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
      if (check && check.fields && typeof check.fields.price !== "undefined") {
        item.price = check.fields.price
      }
      return item
    })
    return validated
  } catch (err) {
    console.error("Contentful price validation failed:", err)
    return cart
  }
}

function sumTotal(cart) {
  return cart.reduce((acc, { quantity, price }) => {
    const qty = Number(quantity)
    const unitPrice = Number(price)
    return acc + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
  }, 0)
}

function compactCartItem(item = {}) {
  const quantity = Number(item.quantity)
  const price = Number(item.price)
  const id =
    typeof item.contentful_id === "string" || typeof item.contentful_id === "number"
      ? String(item.contentful_id)
      : typeof item.id === "string" || typeof item.id === "number"
      ? String(item.id)
      : null
  return {
    contentful_id: id,
    title:
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim().slice(0, 180)
        : "Libro",
    authors: Array.isArray(item.authors)
      ? item.authors
          .filter(author => typeof author === "string")
          .map(author => author.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [],
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
    price: Number.isFinite(price) ? price : 0,
  }
}

function compactCart(cart) {
  if (!Array.isArray(cart)) return []
  return cart.map(item => compactCartItem(item)).filter(item => Boolean(item.contentful_id))
}

function generateBuyOrder() {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `do${seed}`.slice(0, 26)
}

module.exports = async (req, res) => {
  console.log("api/create handler invoked", req && req.method)
  console.log(
    "request body preview:",
    req && req.body && JSON.stringify(req.body).slice(0, 100)
  )
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials - returning explicit error")
    res.status(500)
    return res.json({
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable",
    })
  }
  const { storePayment, updatePayment } = require("../utils/db")
  try {
    if (!req || !req.body) {
      console.error("No req.body present")
      res.status(400)
      return res.json({ error: "No request body" })
    }
    const { name, address, email } = req.body
    const compactedCart = compactCart(req.body.cart)
    const validatedCart = await validateCart(compactedCart)
    const cart = compactCart(validatedCart)

    if (!cart.length) {
      res.status(400)
      return res.json({ errorType: "cart", message: "Cart is empty or invalid" })
    }

    const buyOrder = generateBuyOrder()
    const sessionId = buyOrder

    let payment
    try {
      payment = await storePayment({
        cart,
        name,
        address,
        email,
        status: "INITIALIZED",
        buy_order: buyOrder,
      })
    } catch (err) {
      console.error("storePayment error:", err)
      const resp = {
        errorType: "supabase",
        message: err && err.message ? err.message : String(err),
      }
      if (process.env.DEBUG_API_ERRORS === "true" && err && err.stack)
        resp.stack = err.stack
      res.status(502)
      return res.json(resp)
    }
    if (!payment) {
      console.error("storePayment returned falsy value")
      res.status(500)
      return res.json({
        errorType: "supabase",
        message: "storePayment returned no result",
      })
    }
    const amount = sumTotal(cart)
    const baseUrl = process.env.BASE_URL || "http://localhost:8000"
    const returnUrl = `${baseUrl}/api/commit`

    let url, token
    try {
      const tx = await new WebpayPlus.Transaction().create(
        buyOrder,
        sessionId,
        amount,
        returnUrl
      )
      url = tx.url
      token = tx.token
    } catch (err) {
      console.error("Webpay create error:", err)
      const resp = {
        errorType: "webpay",
        message: err && err.message ? err.message : String(err),
      }
      if (process.env.DEBUG_API_ERRORS === "true" && err && err.stack)
        resp.stack = err.stack
      res.status(502)
      return res.json(resp)
    }

    try {
      await updatePayment(buyOrder, { token, amount })
    } catch (err) {
      console.error("updatePayment error:", err)
      const resp = {
        errorType: "supabase_update",
        message: err && err.message ? err.message : String(err),
      }
      if (process.env.DEBUG_API_ERRORS === "true" && err && err.stack)
        resp.stack = err.stack
      res.status(500)
      return res.json(resp)
    }

    return res.json({ redirect: url + "?token_ws=" + token })
  } catch (err) {
    res.status(500)
    res.json({ error: err.toString() })
  }
}
