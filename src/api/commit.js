const { WebpayPlus } = require("transbank-sdk")
const { updatePayment } = require("../utils/db")
const { notifySuccessfulPayment } = require("../utils/notify")

if (process.env.WPP_CC && process.env.WPP_KEY) {
  WebpayPlus.configureForProduction(process.env.WPP_CC, process.env.WPP_KEY)
} else {
  WebpayPlus.configureForTesting()
}

module.exports = async (req, res) => {
  let params = req.method === "GET" ? req.query : req.body

  let token = params.token_ws
  let tbkToken = params.TBK_TOKEN
  let tbkOrdenCompra = params.TBK_ORDEN_COMPRA
  let tbkIdSesion = params.TBK_ID_SESION

  let viewData = {
    token,
    tbkToken,
    tbkOrdenCompra,
    tbkIdSesion,
  }
  console.log(JSON.stringify(viewData))

  if (token && !tbkToken) {
    const commitResponse = await new WebpayPlus.Transaction().commit(token)
    const payment = await updatePayment(commitResponse.buy_order, {
      status: commitResponse.status,
    })
    if (commitResponse.response_code === 0 && commitResponse.status === "AUTHORIZED") {
      await notifySuccessfulPayment(payment)
    }
    const encoded = encodeURIComponent(
      Buffer.from(JSON.stringify(commitResponse)).toString("base64")
    )
    res.status(301)
    res.setHeader("Location", `/resultado/${encoded}`)
    res.end()
  } else {
    if (!token && !tbkToken) {
      await updatePayment(tbkOrdenCompra, { status: "TIMED OUT" })
    } else if (!token && tbkToken) {
      await updatePayment(tbkOrdenCompra, { status: "ABORTED" })
    } else if (token && tbkToken) {
      await updatePayment(tbkOrdenCompra, { status: "INVALID" })
    }
    res.status(301)
    res.setHeader("Location", `/`)
    res.end()
  }
}
