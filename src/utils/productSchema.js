// ════════════════════════════════════════════════════════════
// FILE: src/utils/productSchema.js
// ════════════════════════════════════════════════════════════
//
// Builds schema.org JSON-LD objects for product, listing, and
// store pages. Inject into your page <head> like this:
//
//   import {
//     buildProductSchema,
//     buildListingPageSchema,
//     buildStoreSchema,
//   } from "../utils/productSchema.js";
//
//   // In your product page component:
//   <script type="application/ld+json">
//     {JSON.stringify(buildProductSchema(product, images))}
//   </script>

const BASE_URL = "https://www.loemart.com";

/*
 * Maps Loemart condition strings → schema.org ItemCondition URIs.
 * https://schema.org/OfferItemCondition
 */
const CONDITION_MAP = {
  "New"         : "https://schema.org/NewCondition",
  "Used"        : "https://schema.org/UsedCondition",
  "Refurbished" : "https://schema.org/RefurbishedCondition",
  "For Parts"   : "https://schema.org/DamagedCondition",
};

/* ─────────────────────────────────────────────────────────────
   buildProductSchema
   Use on: /product/:slug
   Renders as: Product + Offer + BreadcrumbList
───────────────────────────────────────────────────────────── */
export function buildProductSchema(product, images = []) {
  const attrs     = product.attributes ?? {};
  const condition =
    CONDITION_MAP[attrs.condition] ?? "https://schema.org/NewCondition";
  const city      = product.location_city  ?? "";
  const state     = product.location_state ?? "";
  const location  = [city, state].filter(Boolean).join(", ");

  const availability = product.is_active
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  /* Use all product images when available, fall back to thumbnail */
  const imageList =
    images.length > 0
      ? images
      : product.thumbnail_url
      ? [product.thumbnail_url]
      : [];

  return {
    "@context" : "https://schema.org",
    "@type"    : "Product",

    name        : product.title,
    description : product.description,
    image       : imageList,
    url         : `${BASE_URL}/product/${product.slug}`,
    sku         : product.id,

    offers: {
      "@type"       : "Offer",
      price         : Number(product.price).toFixed(2),
      priceCurrency : "NGN",
      availability,
      itemCondition : condition,
      url           : `${BASE_URL}/product/${product.slug}`,
      seller        : {
        "@type" : "Person",
        name    : product.seller_name ?? "Loemart Seller",
      },
      ...(location && { areaServed: location }),
      ...(product.active_until && {
        priceValidUntil : new Date(product.active_until)
          .toISOString()
          .slice(0, 10),
      }),
    },

    /* Only include brand when the seller filled it in */
    ...(attrs.brand && {
      brand: { "@type": "Brand", name: attrs.brand },
    }),

    ...(attrs.color && { color: attrs.color }),

    /* Breadcrumb trail shown in Google search results */
    breadcrumb: {
      "@type"         : "BreadcrumbList",
      itemListElement : [
        {
          "@type"  : "ListItem",
          position : 1,
          name     : "Home",
          item     : BASE_URL,
        },
        {
          "@type"  : "ListItem",
          position : 2,
          name     : "Marketplace",
          item     : `${BASE_URL}/minimart`,
        },
        {
          "@type"  : "ListItem",
          position : 3,
          name     : product.title,
          item     : `${BASE_URL}/product/${product.slug}`,
        },
      ],
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   buildListingPageSchema
   Use on: /categories/:slug  and  /lagos  and  /categories/:slug/:city
   Renders as: ItemList
───────────────────────────────────────────────────────────── */
export function buildListingPageSchema(products, pageUrl, pageName) {
  return {
    "@context"      : "https://schema.org",
    "@type"         : "ItemList",
    name            : pageName,
    url             : pageUrl,
    numberOfItems   : products.length,
    itemListElement : products.slice(0, 10).map((p, i) => ({
      "@type"   : "ListItem",
      position  : i + 1,
      name      : p.title,
      url       : `${BASE_URL}/product/${p.slug}`,
      image     : p.thumbnail_url ?? undefined,
    })),
  };
}

/* ─────────────────────────────────────────────────────────────
   buildStoreSchema
   Use on: /store/:store_slug
   Renders as: LocalBusiness
───────────────────────────────────────────────────────────── */
export function buildStoreSchema(seller, products = []) {
  return {
    "@context"   : "https://schema.org",
    "@type"      : "LocalBusiness",
    name         : seller.store_name ?? seller.name,
    url          : `${BASE_URL}/store/${seller.store_slug}`,
    description  : seller.store_description ?? undefined,
    image        : seller.avatar_url        ?? undefined,

    ...(seller.location_city && {
      address: {
        "@type"         : "PostalAddress",
        addressLocality : seller.location_city,
        addressCountry  : "NG",
      },
    }),

    hasOfferCatalog: {
      "@type"         : "OfferCatalog",
      name            : `${seller.store_name ?? "Seller"} listings`,
      itemListElement : products.slice(0, 5).map((p) => ({
        "@type"     : "Offer",
        itemOffered : {
          "@type" : "Product",
          name    : p.title,
          url     : `${BASE_URL}/product/${p.slug}`,
          image   : p.thumbnail_url ?? undefined,
        },
        price         : Number(p.price).toFixed(2),
        priceCurrency : "NGN",
      })),
    },
  };
}