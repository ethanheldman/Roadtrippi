import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

// ESM compat: __dirname is not defined in ES modules.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

const SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://roadtrippi.com";

// Cached so we only read the SPA HTML once per cold-start.
let spaHtmlCache: string | null = null;

function loadSpaHtml(): string {
  if (spaHtmlCache !== null) return spaHtmlCache;
  // In production on Vercel, the built index.html lives in client/dist/.
  // We resolve from a few known locations to handle both prod and local dev.
  const candidates = [
    // Vercel: /var/task/client/dist/index.html (via includeFiles in vercel.json)
    path.join(process.cwd(), "client", "dist", "index.html"),
    // Inside the bundled function, relative to compiled JS location
    path.join(__dirname, "..", "..", "..", "client", "dist", "index.html"),
    path.join(__dirname, "..", "..", "client", "dist", "index.html"),
    // Fallback for local dev (uses the source index.html — Vite dev server needs different handling)
    path.join(process.cwd(), "client", "index.html"),
  ];
  for (const p of candidates) {
    try {
      const html = fs.readFileSync(p, "utf-8");
      spaHtmlCache = html;
      return html;
    } catch {
      continue;
    }
  }
  // Minimal fallback so we never 500 on a missing file.
  spaHtmlCache = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Roadtrippi</title></head><body><div id="root"></div></body></html>`;
  return spaHtmlCache;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(s: string | null | undefined): string {
  return escapeHtml(s);
}

/**
 * Inject SEO tags into an existing SPA index.html. We replace the <title>
 * (so React Helmet / our useEffect can still rehydrate, but crawlers see ours
 * first), and inject a block of meta + JSON-LD into <head>.
 */
function injectSeo(html: string, opts: {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object | object[];
  extraTags?: string;
}): string {
  const ogImage = opts.ogImage ?? `${SITE_URL}/og.png`;
  const ogType = opts.ogType ?? "website";

  const seo = [
    `<title>${escapeHtml(opts.title)}</title>`,
    `<meta name="description" content="${escapeHtml(opts.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(opts.canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(opts.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(opts.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(opts.canonical)}" />`,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta property="og:site_name" content="Roadtrippi" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(opts.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(opts.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
  ];

  if (opts.jsonLd) {
    const blocks = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
    for (const b of blocks) {
      seo.push(
        `<script type="application/ld+json">${JSON.stringify(b)
          .replace(/</g, "\\u003c")}</script>`
      );
    }
  }

  if (opts.extraTags) seo.push(opts.extraTags);

  // Strip the SPA's existing <title> so ours wins.
  const stripped = html.replace(/<title>[^<]*<\/title>/i, "");
  // Inject just before </head>.
  return stripped.replace(/<\/head>/i, `${seo.join("\n    ")}\n  </head>`);
}

// ---------- State helpers ----------

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function stateNameFromSlug(slug: string): { code: string; name: string } | null {
  const lower = slug.toLowerCase().replace(/-/g, " ");
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (name.toLowerCase() === lower || code.toLowerCase() === lower) {
      return { code, name };
    }
  }
  return null;
}

function stateSlugFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// ---------- Route registration ----------

export async function seoRoutes(app: FastifyInstance) {
  // ===== sitemap.xml =====
  app.get("/api/sitemap.xml", async (_req, reply) => {
    const attractions = await prisma.attraction.findMany({
      select: { id: true, createdAt: true, state: true },
      orderBy: { createdAt: "desc" },
    });

    // Compute distinct states present in DB (some legacy rows have full names; normalize).
    const stateCodesSeen = new Set<string>();
    for (const a of attractions) {
      const s = a.state ?? "";
      if (!s) continue;
      const upper = s.toUpperCase();
      if (STATE_NAMES[upper]) {
        stateCodesSeen.add(upper);
      } else {
        // Try to match by full name
        for (const [code, name] of Object.entries(STATE_NAMES)) {
          if (name.toLowerCase() === s.toLowerCase()) {
            stateCodesSeen.add(code);
            break;
          }
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const urls: string[] = [];

    // High-priority statics
    urls.push(`<url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`);
    urls.push(`<url><loc>${SITE_URL}/map</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
    urls.push(`<url><loc>${SITE_URL}/people</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`);

    // "Best of [State]" landing pages
    for (const code of stateCodesSeen) {
      const slug = stateSlugFromName(STATE_NAMES[code]);
      urls.push(
        `<url><loc>${SITE_URL}/best-roadside-attractions/${slug}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      );
    }

    // All attractions
    for (const a of attractions) {
      const lastmod = a.createdAt.toISOString().slice(0, 10);
      urls.push(
        `<url><loc>${SITE_URL}/attraction/${a.id}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
      );
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.join("\n") +
      `\n</urlset>`;

    reply.header("Content-Type", "application/xml; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return reply.send(xml);
  });

  // ===== robots.txt =====
  app.get("/api/robots.txt", async (_req, reply) => {
    const txt = [
      "User-agent: *",
      "Allow: /",
      "",
      "# AI crawlers — explicitly allowed",
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: ClaudeBot",
      "Allow: /",
      "",
      "User-agent: PerplexityBot",
      "Allow: /",
      "",
      "# Disallow API endpoints from being crawled",
      "User-agent: *",
      "Disallow: /api/",
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      "",
    ].join("\n");
    reply.header("Content-Type", "text/plain; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(txt);
  });

  // ===== /attraction/:id (HTML pre-render with meta tags + JSON-LD) =====
  app.get<{ Params: { id: string } }>("/api/attraction-html/:id", async (req, reply) => {
    const { id } = req.params;
    const a = await prisma.attraction.findUnique({
      where: { id },
      include: {
        attractionCategories: { include: { category: true } },
        _count: { select: { checkIns: true } },
      },
    });

    // If attraction missing, fall back to the regular SPA so the React 404 page shows
    if (!a) {
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.header("Cache-Control", "no-cache");
      return reply.send(loadSpaHtml());
    }

    const ratingAgg = await prisma.checkIn.aggregate({
      where: { attractionId: id, rating: { not: null } },
      _avg: { rating: true },
      _count: { id: true },
    });
    const avgRating = ratingAgg._avg.rating;
    const ratingCount = ratingAgg._count.id;

    const stateCode = (a.state ?? "").toUpperCase();
    const stateName = STATE_NAMES[stateCode] ?? a.state ?? "";
    const cityState = [a.city, stateCode].filter(Boolean).join(", ");
    const categoryNames = a.attractionCategories.map(ac => ac.category.name);
    const primaryType = categoryNames[0] ?? "roadside attraction";

    const title = cityState
      ? `${a.name} in ${cityState} — Roadtrippi`
      : `${a.name} — Roadtrippi`;

    const description =
      `${a.name} is a ${primaryType.toLowerCase()} in ${cityState || stateName || "the United States"}. ` +
      (ratingCount > 0 && avgRating != null
        ? `Rated ${avgRating.toFixed(1)} stars by ${ratingCount} Roadtrippi user${ratingCount === 1 ? "" : "s"}. `
        : "") +
      `Track your visit, save it for later, or read reviews on Roadtrippi — Letterboxd for roadside attractions.`;

    const canonical = `${SITE_URL}/attraction/${a.id}`;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name: a.name,
      description: a.description ?? description,
      url: canonical,
      address: {
        "@type": "PostalAddress",
        addressLocality: a.city ?? undefined,
        addressRegion: stateCode || undefined,
        addressCountry: "US",
      },
    };
    if (a.imageUrl) jsonLd.image = a.imageUrl;
    if (a.latitude != null && a.longitude != null) {
      jsonLd.geo = {
        "@type": "GeoCoordinates",
        latitude: a.latitude,
        longitude: a.longitude,
      };
    }
    if (ratingCount > 0 && avgRating != null) {
      jsonLd.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: avgRating.toFixed(1),
        ratingCount: ratingCount,
        bestRating: "5",
        worstRating: "1",
      };
    }

    const html = injectSeo(loadSpaHtml(), {
      title,
      description,
      canonical,
      ogImage: a.imageUrl ?? `${SITE_URL}/og.png`,
      ogType: "website",
      jsonLd,
    });

    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
    return reply.send(html);
  });

  // ===== /best-roadside-attractions/:state =====
  app.get<{ Params: { state: string } }>("/api/best-of-html/:state", async (req, reply) => {
    const stateInfo = stateNameFromSlug(req.params.state);
    if (!stateInfo) {
      reply.header("Content-Type", "text/html; charset=utf-8");
      return reply.send(loadSpaHtml());
    }
    const { code, name } = stateInfo;

    // Pull top 25 attractions in the state, ranked by avg rating × log(visit count)
    // Quick pragmatic sort: order by createdAt + then re-rank in JS by (avg rating × visits) once we have data
    const attractions = await prisma.attraction.findMany({
      where: { state: code },
      include: {
        attractionCategories: { include: { category: true } },
        _count: { select: { checkIns: true } },
      },
      take: 100,
    });

    // Get rating aggregates for all in one query
    const ratings = attractions.length > 0
      ? await prisma.checkIn.groupBy({
          by: ["attractionId"],
          where: { attractionId: { in: attractions.map(a => a.id) }, rating: { not: null } },
          _avg: { rating: true },
          _count: { id: true },
        })
      : [];
    const ratingMap = new Map<string, { avg: number; count: number }>();
    for (const r of ratings) {
      ratingMap.set(r.attractionId, {
        avg: r._avg.rating ?? 0,
        count: r._count.id,
      });
    }

    // Rank: simple Bayesian-ish — shrink toward 3 stars when few ratings.
    const PRIOR_RATING = 3.0;
    const PRIOR_WEIGHT = 3;
    const ranked = attractions.map(a => {
      const r = ratingMap.get(a.id);
      const rating = r?.avg ?? PRIOR_RATING;
      const count = r?.count ?? 0;
      const score = (PRIOR_WEIGHT * PRIOR_RATING + count * rating) / (PRIOR_WEIGHT + count);
      return { a, rating, count, score };
    });
    ranked.sort((x, y) => y.score - x.score || y.count - x.count);
    const top = ranked.slice(0, 25);

    const year = new Date().getFullYear();
    const totalCount = await prisma.attraction.count({ where: { state: code } });

    const title = `The ${top.length} Best Roadside Attractions in ${name} (${year}) — Roadtrippi`;
    const description = `The ${top.length} best roadside attractions in ${name}, ranked by Roadtrippi users. Muffler Men, World's Largests, Mystery Spots, and more weird Americana. Free, no signup needed to browse.`;
    const canonical = `${SITE_URL}/best-roadside-attractions/${stateSlugFromName(name)}`;

    const itemListJsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: title,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: top.length,
      itemListElement: top.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "TouristAttraction",
          name: t.a.name,
          url: `${SITE_URL}/attraction/${t.a.id}`,
          ...(t.a.city ? { address: {
            "@type": "PostalAddress",
            addressLocality: t.a.city,
            addressRegion: code,
            addressCountry: "US",
          }} : {}),
          ...(t.a.imageUrl ? { image: t.a.imageUrl } : {}),
        },
      })),
    };

    // Server-side rendered "for crawlers" content. Hidden from the SPA via CSS
    // (the React app will mount and replace #root), but visible to crawlers
    // who don't run JS. Live users see the SPA almost immediately.
    const crawlerContent = `
<noscript-style>${`
  /* When the SPA hydrates, it replaces #root content. The crawler-content
     div is in the DOM but won't matter for users since React takes over. */
  #crawler-seo-content { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  #crawler-seo-content * { font-size: 14px; }
`}</noscript-style>
`.trim();

    const itemsHtml = top.map((t, i) => {
      const r = ratingMap.get(t.a.id);
      const rating = r?.avg != null ? r.avg.toFixed(1) : null;
      const ratingCount = r?.count ?? 0;
      const cityStateLabel = [t.a.city, code].filter(Boolean).join(", ");
      return `
        <li>
          <h2>${i + 1}. ${escapeHtml(t.a.name)}</h2>
          <p><strong>${escapeHtml(cityStateLabel)}</strong>${rating ? ` — ★ ${rating} (${ratingCount} review${ratingCount === 1 ? "" : "s"})` : ""}</p>
          ${t.a.description ? `<p>${escapeHtml(t.a.description.slice(0, 280))}</p>` : ""}
          <p><a href="${SITE_URL}/attraction/${t.a.id}">See on Roadtrippi →</a></p>
        </li>
      `;
    }).join("\n");

    const articleHtml = `
<article id="crawler-seo-content" data-seo="best-of-${code}">
  <h1>The ${top.length} Best Roadside Attractions in ${escapeHtml(name)}</h1>
  <p>Ranked by Roadtrippi users — the people who've actually been there. Updated ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Roadtrippi catalogs ${totalCount} roadside attractions in ${escapeHtml(name)}.</p>
  <ol>
    ${itemsHtml}
  </ol>
  <p>Browse all ${totalCount} attractions in ${escapeHtml(name)} on <a href="${SITE_URL}/">Roadtrippi</a>.</p>
</article>
`.trim();

    const html = injectSeo(loadSpaHtml(), {
      title,
      description,
      canonical,
      jsonLd: itemListJsonLd,
      ogType: "article",
      extraTags: `<style>#crawler-seo-content { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }</style>`,
    });

    // Inject the crawler-visible content right after <body>
    const finalHtml = html.replace(/<body([^>]*)>/i, `<body$1>\n  ${articleHtml}\n`);

    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
    return reply.send(finalHtml);
  });

  // ===== Static OG image fallback =====
  // Served at /og.png (we do NOT generate per-attraction images dynamically in v1
  // because adding image-rendering deps to the serverless bundle is risky for launch).
  // The static og.png lives in client/public and is served by Vercel's static layer.
}
