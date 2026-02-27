/**
 * shortcut-submit/index.ts
 * Public Supabase Edge Function — POST /functions/v1/shortcut-submit
 *
 * Called from iOS Shortcuts. Accepts an Instagram URL, saves it to the
 * saved_content table, then fires caption extraction in the background.
 *
 * Deploy with: supabase functions deploy shortcut-submit --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: object) =>
    new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
    });

const fail = (error: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });

// ── URL helpers ───────────────────────────────────────────────────────────────

function isInstagramUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        return (
            u.hostname === "www.instagram.com" ||
            u.hostname === "instagram.com" ||
            u.hostname === "instagr.am"
        );
    } catch {
        return false;
    }
}

/** Strip tracking params, return clean canonical URL */
function cleanInstagramUrl(raw: string): string {
    try {
        const u = new URL(raw);
        return `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/$/, "") + "/";
    } catch {
        return raw;
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
    try {
        // CORS preflight
        if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
        if (req.method !== "POST") return fail("Only POST requests are accepted.", 405);

        // Parse body
        let body: { url?: string };
        try {
            body = await req.json();
        } catch {
            return fail("Invalid JSON body.");
        }

        const rawUrl = (body?.url || "").trim();

        // Validate
        if (!rawUrl) return fail("Missing field: url.");
        if (!isInstagramUrl(rawUrl)) return fail("URL must be a valid Instagram link.");

        const cleanUrl = cleanInstagramUrl(rawUrl);
        console.log("[shortcut-submit] url:", cleanUrl);

        // DB client
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Check for a duplicate (same URL already saved)
        const { data: existing } = await supabase
            .from("saved_content")
            .select("id")
            .eq("url", cleanUrl)
            .maybeSingle();

        if (existing) {
            console.log("[shortcut-submit] duplicate, skipping insert. id:", existing.id);
            // Still trigger extraction in case it hasn't been done yet
            supabase.functions.invoke("extract-caption", { body: { id: existing.id } })
                .catch((e: unknown) => console.error("[shortcut-submit] extract error:", e));
            return ok({ success: true, note: "Already saved. Extraction triggered.", id: existing.id });
        }

        // Count existing records to generate the next number
        const { count } = await supabase
            .from("saved_content")
            .select("*", { count: "exact", head: true });

        const nextNumber = (count ?? 0) + 1;
        const autoTitle = `Reel ${nextNumber}`;
        console.log("[shortcut-submit] assigning title:", autoTitle);

        // Insert new record with auto-numbered title
        const { data: inserted, error: insertErr } = await supabase
            .from("saved_content")
            .insert({
                url: cleanUrl,
                title: autoTitle,
                status: "Saved",
                user_id: "00000000-0000-0000-0000-000000000000",
            })
            .select("id")
            .single();

        if (insertErr || !inserted) {
            console.error("[shortcut-submit] insert error:", insertErr?.message);
            return fail("Failed to save URL to database.", 500);
        }

        console.log("[shortcut-submit] inserted id:", inserted.id);

        // Fire caption extraction (non-blocking — don't await)
        supabase.functions.invoke("extract-caption", { body: { id: inserted.id } })
            .catch((e: unknown) => console.error("[shortcut-submit] extract error:", e));

        return ok({ success: true, id: inserted.id });

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[shortcut-submit] TOP-LEVEL ERROR:", msg);
        return fail(`Unexpected server error: ${msg}`, 500);
    }
});
