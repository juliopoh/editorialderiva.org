/** @jsx jsx */
import { jsx, Themed, Grid, Box, Button, Divider, IconButton } from "theme-ui"
import { graphql, navigate, Link } from "gatsby"
import Layout from "../components/layout"
import Seo from "../components/seo"
import ItemCard from "../components/item-card"
import BlogRoll from "../components/blogroll"
import Water from "../components/water"
import React from "react"
import scrollTo from "gatsby-plugin-smoothscroll"

const Hero = ({ site }) => {
  return (
    <React.Fragment>
      <div
        sx={{
          position: "absolute",
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
        }}
      >
        <Water />
      </div>
      <div
        style={{
          height: "calc(100vh - 48px)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div sx={{ height: "100%", width: "100%", display: "flex", p: 2 }}>
          <div sx={{ my: 100, textAlign: "center", maxWidth: 540, mx: "auto" }}>
            <Themed.h1
              sx={{
                zIndex: 10,
                position: "relative",
                userSelect: "none",
                color: "primary",
              }}
            >
              {site.siteMetadata.title}
            </Themed.h1>
            <Themed.h3
              sx={{
                zIndex: 10,
                position: "relative",
                userSelect: "none",
                color: "primary",
              }}
            >
              {site.siteMetadata.description}
            </Themed.h3>
            <Themed.h5
              sx={{
                color: "primary",
              }}
            >
              de {site.siteMetadata.location} con 🖤
            </Themed.h5>
            <Button
              sx={{
                zIndex: 10,
                position: "relative",
                userSelect: "none",
                m: 2,
              }}
              onClick={() => navigate("/nosotros")}
            >
              ¿Quienes somos?
            </Button>
            <Button
              variant="inverted"
              sx={{
                zIndex: 10,
                position: "relative",
                userSelect: "none",
                m: 2,
              }}
              onClick={() => navigate("/catalogo")}
            >
              Catálogo de libros
            </Button>
            <div sx={{ textAlign: "center", mx: "auto" }}>
              <IconButton
                onClick={() => scrollTo("#lastbooks")}
                offset={50}
                duration={500}
                delay={1000}
                sx={{
                  zIndex: 10,
                  position: "relative",
                  userSelect: "none",
                  m: 2,
                  my: 40,
                }}
              >
                <svg sx={{ fill: "text", height: "100px", width: "100px" }} viewBox="0 0 448 512">
                  <path d="M224 416c-8.188 0-16.38-3.125-22.62-9.375l-192-192c-12.5-12.5-12.5-32.75 0-45.25s32.75-12.5 45.25 0L224 338.8l169.4-169.4c12.5-12.5 32.75-12.5 45.25 0s12.5 32.75 0 45.25l-192 192C240.4 412.9 232.2 416 224 416z" />
                </svg>
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  )
}

const NewItems = ({ items }) => {
  return (
    <div sx={{ mt: 5 }}>
      <Themed.h1 id="lastbooks" sx={{ textAlign: "center" }}>
        Últimas publicaciones
      </Themed.h1>
      <div sx={{ textAlign: "center" }}>
        <Grid variant="primary" sx={{ maxWidth: 960, mx: "auto" }}>
          {items.map(item => (
            <ItemCard key={item.contentful_id} data={item} />
          ))}
          <Box sx={{ gridColumn: [null, 2, null, 4], display: "flex" }}>
            <Themed.p sx={{ m: "auto" }}>
              Esto y más en{" "}
              <Link to="/catalogo" sx={t => t.styles.a}>
                <u>nuestro catálogo</u>
              </Link>
            </Themed.p>
            <Divider />
          </Box>
        </Grid>
      </div>
    </div>
  )
}

const NewPosts = ({ items }) => {
  return (
    <div sx={{ mt: 5 }}>
      <Themed.h1 sx={{ textAlign: "center" }}>Notas</Themed.h1>
      <BlogRoll items={items} />
      <Themed.p sx={{ textAlign: "center", mt: "10" }}>
        Todas las notas{" "}
        <Link to="/blog" sx={t => t.styles.a}>
          acá 👈
        </Link>
      </Themed.p>
    </div>
  )
}

export default function IndexPage({ data, ...props }) {
  const { site, allContentfulLibro, allContentfulBlogPost } = data
  return (
    <Layout {...props}>
      <Seo title="Inicio" />
      <Hero site={site} />
      <NewItems items={allContentfulLibro.nodes} />
      <NewPosts items={allContentfulBlogPost.nodes} />
    </Layout>
  )
}

export const query = graphql`
  query IndexQuery {
    site {
      siteMetadata {
        title
        description
        location
      }
    }
    allContentfulLibro(limit: 3, sort: { order: DESC, fields: updatedAt }) {
      nodes {
        contentful_id
        id
        title
        authors
        price
        image {
          gatsbyImageData
        }
      }
    }
    allContentfulBlogPost(limit: 2, sort: { order: DESC, fields: date }) {
      nodes {
        id
        title
        author
        image {
          gatsbyImageData
        }
        date(formatString: "MMMM YYYY", locale: "es")
        description
      }
    }
  }
`
