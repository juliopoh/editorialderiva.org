const { Telegraf } = require("telegraf")
const { telegram } = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

exports.notifySuccessfulPayment = async function (payment) {
  const data = payment && payment.data ? payment.data : payment
  if (!data) {
    throw new Error("Payment data missing for notification")
  }
  const { name, email, address, cart, amount } = data
  const items = cart.map(item => item.title + " x " + item.quantity).join("\n- ")
  const message = `${name} compró:\n- ` + items + `\nPor un total de $${amount}\nContactar a ${email}\nDirección: ${address}`
  const sent = await telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, message)
  return sent
}
