/** @jsx jsx */
import { jsx, Box, Label, Input, Button } from "theme-ui"
import { useState } from "react"
import { useCart } from "../store"

export default function CheckoutForm() {
  const { cart } = useCart()
  const [state, setState] = useState({ name: "", address: "", email: "" })
  const [error, setError] = useState("")

  const compactCart = currentCart =>
    (Array.isArray(currentCart) ? currentCart : [])
      .map(item => ({
        contentful_id: item && (item.contentful_id || item.id),
        title: typeof (item && item.title) === "string" ? item.title : "Libro",
        authors: Array.isArray(item && item.authors)
          ? item.authors.filter(author => typeof author === "string").slice(0, 3)
          : [],
        quantity: Number(item && item.quantity) > 0 ? Math.floor(Number(item.quantity)) : 1,
        price: Number.isFinite(Number(item && item.price)) ? Number(item.price) : 0,
      }))
      .filter(item => Boolean(item.contentful_id))

  const handleChange = async event => {
    const value = event.target.value
    setState({
      ...state,
      [event.target.name]: value,
    })
  }

  const handleSubmit = async event => {
    event.preventDefault()
    // basic client-side validation: require name and email
    if (!state.name || !state.email) {
      setError("Por favor ingresa nombre y correo electrónico")
      return
    }
    setError("")
    console.log("Submitting order", { cart, ...state })
    try {
      const safeCart = compactCart(cart)
      // use an absolute path so requests always target the site's API root
      let response = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: safeCart, ...state }),
      })
      let { redirect } = await response.json()
      console.log(redirect)
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
      {error && (
        <Box as="p" sx={{ color: "red", mt: 2, fontSize: 1 }}>{error}</Box>
      )}
  <Button type="submit">Proceder con el pago</Button>
    </Box>
  )
}
