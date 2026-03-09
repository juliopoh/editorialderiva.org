import { WebpayPlus } from "transbank-sdk"
import { updatePayment } from "../src/utils/db"
import { notifySuccessfulPayment } from "../src/utils/notify"

if (process.env.WPP_CC && process.env.WPP_KEY) {
  WebpayPlus.configureForProduction(process.env.WPP_CC, process.env.WPP_KEY)
} else {
  WebpayPlus.configureForTesting()
}

export default async function handler(req, res) {
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
    // NORMAL (solo llega token_ws, tanto si es un rechazo o una aprobación)
    const commitResponse = await new WebpayPlus.Transaction().commit(token)
    const payment = await updatePayment(commitResponse.buy_order, { status: commitResponse.status })
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
      // TIMEOUT (llegan TBK_ID_SESION y TBK_ORDEN_COMPRA)
      await updatePayment(tbkOrdenCompra, { status: "TIMED OUT" })
    } else if (!token && tbkToken) {
      // ABORTED (llegan TBK_TOKEN, TBK_ID_SESION, TBK_ORDEN_COMPRA)
      await updatePayment(tbkOrdenCompra, { status: "ABORTED" })
    } else if (token && tbkToken) {
      // INVALID (llega todos token_ws, TBK_TOKEN, TBK_ID_SESION, TBK_ORDEN_COMPRA)
      await updatePayment(tbkOrdenCompra, { status: "INVALID" })
    }
    res.status(301)
    res.setHeader("Location", `/`)
    res.end()
  }
}
