/** @jsx jsx */
import { jsx, Box, Label, Input, Button } from "theme-ui"
import { useState } from "react"
import { useCart } from "../store"

export default function CheckoutForm() {
  const { cart } = useCart()
  const [state, setState] = useState()

  const handleChange = async event => {
    const value = event.target.value
    setState({
      ...state,
      [event.target.name]: value,
    })
  }

  const handleSubmit = async event => {
    event.preventDefault()
    console.log("Submitting order", { cart, ...state })
    try {
      let response = await fetch("./api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, ...state }),
      })
      let { redirect } = await response.json()
      if (redirect) {
        window.location.assign(redirect)
      }
    } catch (error) {
      console.error(error)
    }
  }
  return (
    <Box
      as="form"
      sx={{
        variant: "forms.primary",
        position: "relative",
      }}
      onChange={handleChange}
      onSubmit={handleSubmit}
    >
      <Label htmlFor="name">Nombre</Label>
      <Input type="text" name="name" id="name" required />
      <Label htmlFor="address">Dirección</Label>
      <Input type="text" name="address" id="address" required />
      <Label htmlFor="email">Correo electrónico</Label>
      <Input type="email" name="email" id="email" required />
      <Button onClick={handleSubmit}>Proceder con el pago</Button>
    </Box>
  )
}
