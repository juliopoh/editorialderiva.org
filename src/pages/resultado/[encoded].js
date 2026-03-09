/** @jsx jsx */
import { jsx, Themed, Flex } from "theme-ui"
import { Link } from "gatsby"
import React from "react"

import Layout from "../../components/layout"
import TransactionDetails from "../../components/transaction-details"

const isBrowser = typeof window !== "undefined"

export default function Resultado({ params }) {
  if (isBrowser) {
    const encoded = decodeURIComponent(params.encoded)
    const data = JSON.parse(atob(encoded))
    const authorized = data.response_code === 0 && data.status === "AUTHORIZED"
    return (
      <Layout>
        {authorized ? (
          <React.Fragment>
            <Themed.h1 sx={{ textAlign: "center" }}>🥳 Pago exitoso</Themed.h1>
            <Themed.p sx={{ textAlign: "center" }}>
              Hemos recibido tu pago exitosamente.
              <br />
              Nos pondremos en contacto a la brevedad para coordinar los detalles de tu envío 📦
            </Themed.p>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <Themed.h1 sx={{ textAlign: "center" }}>😢 Algo falló</Themed.h1>
            <Themed.p sx={{ textAlign: "center" }}>
              Hubo un problema al procesar tu pago.
              <br />
              No te preocupes, no se hizo ningún recargo.
              <br />
              Si gustas puedes intentarlo nuevamente, tus compras están en el{" "}
              <Link to="/carrito" sx={t => t.styles.a}>
                carrito
              </Link>
              .
            </Themed.p>
          </React.Fragment>
        )}
        <Flex sx={{ flexDirection: "column", maxWidth: "blog", mx: "auto" }}>
          <TransactionDetails {...data} />
        </Flex>
      </Layout>
    )
  }
}
