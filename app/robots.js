import { SITE_URL } from "@/lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/tanks", "/account", "/dev"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
