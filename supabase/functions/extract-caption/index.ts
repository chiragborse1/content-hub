/**
 * extract-caption/index.ts
 * Supabase Edge Function — POST /functions/v1/extract-caption
 * Body: { id: string }
 *
 * Fetches the Instagram post page HTML and extracts the caption from
 * og:description / og:title meta tags. No API key required.
 *
 * Single-user mode — deploy with --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── HTML scraping helpers ─────────────────────────────────────────────────────

/** Extract a meta tag content value from raw HTML. */
function getMeta(html: string, property: string): string | null {
  // Matches: <meta property="og:description" content="...">
  // or:      <meta content="..." property="og:description">
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

/** Decode common HTML entities in extracted text. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Clean the raw og:description from Instagram.
 * Typical format: "Caption text. 1,234 likes, 56 comments - Author on date"
 * We strip the trailing stats part.
 */
function parseCaption(raw: string | null): string | null {
  if (!raw) return null;
  // Remove trailing " - Author on ..." or "X likes, X comments..."
  let cleaned = raw
    .replace(/\s*\d[\d,]*\s+likes?,\s*\d[\d,]*\s+comments?.*/i, "")
    .replace(/\s*-\s*.+\s+on\s+(January|February|March|April|May|June|July|August|September|October|November|December).*/i, "")
    .trim();

  // If cleaned is empty or looks like a default IG title, return null
  if (!cleaned || /^(video|photo) by /i.test(cleaned)) return null;
  return cleaned;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return respond({ error: "Use POST." }, 405);

    // 1. Parse body
    let id: string;
    try {
      const body = await req.json();
      id = body?.id;
    } catch {
      return respond({ error: "Invalid JSON body. Expected { id: string }." }, 400);
    }
    if (!id) return respond({ error: "Missing field: id." }, 400);

    // 2. Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Load record
    const { data: record, error: dbErr } = await supabase
      .from("saved_content")
      .select("id, url, thumbnail, original_caption")
      .eq("id", id)
      .single();

    if (dbErr || !record) return respond({ error: "Record not found." }, 404);
    if (!record.url) return respond({ error: "Record has no URL." }, 422);

    // 4. Clean URL (strip tracking params)
    let cleanUrl = record.url;
    try {
      const u = new URL(record.url);
      cleanUrl = `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch { /* use original */ }

    console.log("[extract-caption] fetching page:", cleanUrl);

    // 5. Fetch the Instagram page HTML
    let html = "";
    try {
      const pageRes = await fetch(cleanUrl, {
        headers: {
          // Mobile user-agent gets richer meta tags from Instagram
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(12_000),
        redirect: "follow",
      });

      console.log("[extract-caption] page status:", pageRes.status);

      if (!pageRes.ok) {
        return respond(
          { error: `Instagram returned HTTP ${pageRes.status}. The post may be private or the URL invalid.` },
          400
        );
      }

      html = await pageRes.text();
      console.log("[extract-caption] HTML length:", html.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[extract-caption] fetch error:", msg);
      return respond({ error: `Failed to fetch Instagram page: ${msg}` }, 502);
    }

    // 6. Extract meta tags
    const rawDescription = getMeta(html, "og:description");
    const rawTitle = getMeta(html, "og:title");
    const thumbnail = getMeta(html, "og:image");

    console.log("[extract-caption] og:description:", rawDescription?.slice(0, 100) ?? "(none)");
    console.log("[extract-caption] og:title:", rawTitle?.slice(0, 80) ?? "(none)");

    // 7. Parse caption (prefer description, fall back to title)
    const caption = parseCaption(rawDescription) ?? parseCaption(rawTitle);

    console.log("[extract-caption] extracted caption:", caption?.slice(0, 80) ?? "(none)");

    // 8. Build update payload
    const payload: Record<string, string | null> = {};
    if (caption) payload.original_caption = caption;
    if (!record.thumbnail && thumbnail) payload.thumbnail = thumbnail;

    if (Object.keys(payload).length === 0) {
      return respond({
        success: true,
        extracted: false,
        message: "No caption found. The post may have no caption, or Instagram blocked the page fetch.",
        data: record,
      });
    }

    // 9. Save to DB
    const { data: updated, error: updateErr } = await supabase
      .from("saved_content")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      return respond({ error: `DB update failed: ${updateErr.message}` }, 500);
    }

    console.log("[extract-caption] success ✓ extracted:", Object.keys(payload));
    return respond({ success: true, extracted: true, data: updated });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract-caption] TOP-LEVEL ERROR:", msg);
    return respond({ error: `Unexpected server error: ${msg}` }, 500);
  }
});
