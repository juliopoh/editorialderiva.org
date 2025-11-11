const contentful = require("contentful")
const { WebpayPlus } = require("transbank-sdk")

if (process.env.WPP_CC && process.env.WPP_KEY) {
  WebpayPlus.configureForProduction(process.env.WPP_CC, process.env.WPP_KEY)
} else {
  WebpayPlus.configureForTesting()
}

async function validateCart(cart) {
  console.log("Validating cart", cart)
  /*
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
    item.price = check.fields.price
    return item
  })
  return validated
  */
  return cart
}

function sumTotal(cart) {
  return cart.reduce((acc, { quantity, price }) => acc + quantity * price, 0)
}

module.exports = async (req, res) => {
  console.log('api/create handler invoked', req && req.method)
  console.log('request body preview:', req && req.body && JSON.stringify(req.body).slice(0, 100))
  // fail early and return a clear JSON error if the Fauna key is missing in production
  if (!process.env.FAUNA_ADMIN_KEY) {
    console.error('Missing FAUNA_ADMIN_KEY - returning explicit error')
    res.status(500)
    return res.json({ error: 'Missing FAUNA_ADMIN_KEY environment variable' })
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
    const payment = await storePayment({ cart, name, address, email, status: "INITIALIZED" })
    if (!payment) {
      console.error('storePayment returned falsy value')
      throw new Error('Failed to store payment')
    }
    const buyOrder = payment.ref.value.id
    const sessionId = payment.ref.value.id
    const amount = sumTotal(cart)
    const returnUrl = `${process.env.BASE_URL}/api/commit`

    const { url, token } = await new WebpayPlus.Transaction().create(buyOrder, sessionId, amount, returnUrl)

    await updatePayment(buyOrder, { token, amount })

    res.json({ redirect: url + "?token_ws=" + token })
  } catch (err) {
    res.status(500)
    res.json({ error: err.toString() })
  }
}
