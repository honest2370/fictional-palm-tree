import { useEffect } from "react";

const SITE_URL = "https://sellizi.app";
const SITE_NAME = "Sellizi";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

interface SeoProps {
  title: string;
  description: string;
  path: string; // e.g. "/product/my-product"
  image?: string | null;
  type?: "website" | "product" | "article" | "profile";
  noindex?: boolean;
  jsonLd?: object | object[];
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Injects per-page <title>, meta description, Open Graph/Twitter tags,
 * canonical link, and JSON-LD structured data. Mount once near the top of
 * every route-level page component. Cleans up its own JSON-LD on unmount
 * so it doesn't leak into the next page.
 */
export function Seo({ title, description, path, image, type = "website", noindex, jsonLd }: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
    const url = `${SITE_URL}${path}`;
    const img = image || DEFAULT_IMAGE;

    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setLink("canonical", url);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type === "product" ? "product" : type === "article" ? "article" : "website");
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", img);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", img);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      if (script) document.head.removeChild(script);
    };
  }, [title, description, path, image, type, noindex, JSON.stringify(jsonLd)]);

  return null;
}

export function productJsonLd(product: {
  title: string; description: string | null; cover_url: string | null; price: number; currency: string;
  rating_avg: number; rating_count: number; slug: string; status: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    image: product.cover_url || DEFAULT_IMAGE,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: product.price,
      availability: product.status === "approved" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/product/${product.slug}`,
    },
    ...(product.rating_count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating_avg, reviewCount: product.rating_count } }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
