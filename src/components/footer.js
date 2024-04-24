/** @jsx jsx */
import { jsx, Container, Themed } from "theme-ui"
import { Link } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"

import SocialIcons from "./social-icons"

export default function Footer() {
  return (
    <footer sx={{ position: "relative", variant: "layout.footer" }}>
      <Container sx={{ display: "flex", flexDirection: "column" }}>
         <Link to="/" sx={{ textAlign: "center" }}>
          <StaticImage src="../images/icons/deriva-circle.svg" width={40} quality={100} formats={["AUTO", "WEBP", "AVIF"]} alt={"Editorial Deriva"} sx={{ mx: "auto", zIndex: 10 }}  />
        </Link>
        <Themed.p sx={{ textAlign: "center", fontSize: 0, color: "background" }}>
           <Link to="/" sx={t => ({ ...t.styles.a, color: "background" })}>
            Editorial Deriva
          </Link>  © 2019 - {new Date().getFullYear()}{" "}
        
          <br />
          Calle Los Artesanos Nro. 195
          <br />
          Villa Alegre, Región del Maule
          <br />
          📧 contacto@editorialderiva.org  📞+56 9 6215 2893
        </Themed.p>
        <SocialIcons />      
        <Themed.h6 sx={{ textAlign: "center", color: "background", mt: "5" }}>
        <Link to="https://piducan.dev" sx={t => ({ ...t.styles.a, color: "background" })} target="_blank" rel="noreferrer">   🧑‍💻 desarrollado por piducan.dev </Link>
        </Themed.h6>
        
      </Container>
    </footer>
  )
}
