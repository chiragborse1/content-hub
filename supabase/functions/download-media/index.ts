/**
 * download-media/index.ts
 * Supabase Edge Function — GET /functions/v1/download-media?id=<uuid>
 *
 * 1. Fetches the Instagram page HTML (mobile User-Agent)
 * 2. Extracts the direct media URL (video or image)
 * 3. Streams the media file to the client with download headers
 *
 * Single-user mode — deploy with --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const errResponse = (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });

// ── HTML / JSON extraction helpers ────────────────────────────────────────────

function getMeta(html: string, property: string): string | null {
    const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
            // Decode HTML entities — URLs in meta tags use &amp; instead of &
            return m[1].trim()
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        }
    }
    return null;
}


/**
 * Extract the direct video CDN URL from Instagram's embedded page JSON.
 * The "video_url" key in inlined script JSON is the actual MP4, not a manifest.
 */
function extractJsonVideoUrl(html: string): string | null {
    const patterns = [
        /"video_url"\s*:\s*"(https?:[^"\\][^"]*\.mp4[^"]*)"/,
        /"video_url"\s*:\s*"(https?:[^"]+)"/,
        /"playback_url"\s*:\s*"(https?:[^"]+)"/,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
            return m[1]
                .replace(/\\u0026/g, "&")
                .replace(/\\\//g, "/")
                .trim();
        }
    }
    return null;
}

/** Returns true only if the URL looks like a direct media file. */
function isDirectMedia(url: string): boolean {
    try {
        const p = new URL(url).pathname.toLowerCase();
        return (
            /\.(mp4|webm|mov|jpg|jpeg|png|webp)$/i.test(p) ||
            p.includes("/mp4/") ||
            url.includes("cdninstagram.com") ||
            url.includes("fbcdn.net")
        );
    } catch {
        return false;
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
    try {
        if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
        if (req.method !== "GET") return errResponse("Use GET.", 405);

        // 1. Parse id
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return errResponse("Missing query parameter: id.");

        // 2. Load URL from DB
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: record, error: dbErr } = await supabase
            .from("saved_content")
            .select("url")
            .eq("id", id)
            .single();

        if (dbErr || !record) return errResponse("Record not found.", 404);
        if (!record.url) return errResponse("Record has no URL.", 422);

        // 3. Strip tracking params from URL
        let cleanUrl = record.url;
        try {
            const u = new URL(record.url);
            cleanUrl = `${u.protocol}//${u.hostname}${u.pathname}`;
        } catch { /* use original */ }

        console.log("[download-media] fetching page:", cleanUrl);

        // 4. Fetch the Instagram page HTML
        let html: string;
        try {
            const pageRes = await fetch(cleanUrl, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                },
                signal: AbortSignal.timeout(15_000),
                redirect: "follow",
            });

            console.log("[download-media] page status:", pageRes.status);

            if (pageRes.status === 404) return errResponse("Post not found or deleted.", 404);
            if (!pageRes.ok) return errResponse(`Instagram returned HTTP ${pageRes.status}. Post may be private.`, 400);

            html = await pageRes.text();
            console.log("[download-media] HTML length:", html.length);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return errResponse(`Failed to fetch Instagram page: ${msg}`, 502);
        }

        // 5. Private / login page detection
        if (
            html.includes('"is_private":true') ||
            html.includes("Sorry, this page") ||
            (html.length < 5000 && html.includes("login"))
        ) {
            return errResponse("Post is private or Instagram blocked the request.", 403);
        }

        // 6. Extract media URL
        //    For video: prefer embedded JSON video_url (direct MP4) over og:video (often a manifest)
        //    For image: use og:image
        const jsonVideo = extractJsonVideoUrl(html);

        const ogVideoRaw = getMeta(html, "og:video:secure_url") ?? getMeta(html, "og:video");
        const ogVideo = ogVideoRaw && isDirectMedia(ogVideoRaw) ? ogVideoRaw : null;

        const ogImage = getMeta(html, "og:image");

        const mediaUrl = jsonVideo ?? ogVideo ?? ogImage;
        const isVideo = !!(jsonVideo ?? ogVideo);
        const mimeType = isVideo ? "video/mp4" : "image/jpeg";
        const ext = isVideo ? "mp4" : "jpg";
        const slug = cleanUrl.replace(/\/$/, "").split("/").filter(Boolean).at(-1) ?? "media";
        const filename = `instagram_${slug}.${ext}`;

        console.log("[download-media] jsonVideo:", !!jsonVideo, "| ogVideo:", !!ogVideo, "| ogImage:", !!ogImage);
        console.log("[download-media] mediaUrl:", mediaUrl?.slice(0, 100));

        if (!mediaUrl) {
            return errResponse("No media found. Post may be private or a carousel.", 404);
        }

        // 7. Return the resolved URL — browser opens it directly (avoids CDN 403 on server proxy)
        const newSlug = cleanUrl.replace(/\/$/, "").split("/").filter(Boolean).at(-1) ?? "media";
        const newFilename = `instagram_${newSlug}.${isVideo ? "mp4" : "jpg"}`;

        console.log("[download-media] returning URL for browser download:", newFilename);
        return new Response(
            JSON.stringify({ url: mediaUrl, filename: newFilename, mimeType, isVideo }),
            { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
        );

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[download-media] TOP-LEVEL ERROR:", msg);
        return errResponse(`Unexpected server error: ${msg}`, 500);
    }
});
