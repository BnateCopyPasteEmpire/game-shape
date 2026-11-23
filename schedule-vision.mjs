// Reads a schedule photo, screenshot, or PDF with Claude and returns structured events.
// POST { data: base64, mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf", hints: { myTeam, sport, timezone, today }, device }
// Needs env var ANTHROPIC_API_KEY. Optional ANTHROPIC_MODEL (default claude-haiku-5-5, fast enough for Netlify's 10 second limit).
import { getStore } from "@netlify/blobs";
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const TOOL = {
  name: "save_schedule",
  description: "Save every scheduled event found in the document.",
  input_schema: {
    type: "object",
    properties: {
      events: { type: "array", items: { type: "object", properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        start: { type: ["string", "null"], description: "24h HH:MM, null if no time" },
        end: { type: ["string", "null"], description: "24h HH:MM, null if not shown" },
        title: { type: "string", description: "Short title. For team games use 'vs Opponent' (home) or '@ Opponent' (away) from the user's team point of view when known." },
        homeTeam: { type: ["string", "null"] }, awayTeam: { type: ["string", "null"] },
        opponent: { type: ["string", "null"] }, homeAway: { type: ["string", "null"], enum: ["home", "away", null] },
        location: { type: ["string", "null"] },
        type: { type: "string", enum: ["game", "practice", "event", "race"] },
        confidence: { type: "number", description: "0 to 1. Lower it for any cell that was hard to read or guessed." },
        sourceText: { type: "string", description: "The row's original text as written." }
      }, required: ["date", "title", "type", "confidence", "sourceText"] } },
      teamsFound: { type: "array", items: { type: "string" } },
      yearAssumed: { type: ["integer", "null"] },
      notes: { type: ["string", "null"] }
    },
    required: ["events", "teamsFound"]
  }
};
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Photo import isn't turned on yet. Use a file or calendar link for now.", code: "NO_KEY" }, 503);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const mediaType = String(b.mediaType || ""), data = String(b.data || "");
  if (!TYPES.includes(mediaType) || !data) return json({ error: "Send a photo (JPG or PNG) or a PDF." }, 400);
  if (data.length > 6_000_000) return json({ error: "That file is too big. Try a screenshot or a smaller photo." }, 413);

  // 10 photo reads per device per day
  try {
    const store = getStore("schedule-vision"), day = new Date().toISOString().slice(0, 10);
    const rk = "rate-" + String(b.device || "anon").slice(0, 60) + "-" + day, n = (await store.get(rk, { type: "json" })) || 0;
    if (n >= 10) return json({ error: "Daily limit reached (10 photos). Try again tomorrow." }, 429);
    await store.setJSON(rk, n + 1);
  } catch { /* storage hiccup: allow the read */ }

  const h = b.hints || {};
  const prompt = [
    "Extract every scheduled event from this schedule.",
    "Today's date is " + (h.today || new Date().toISOString().slice(0, 10)) + ". Times are local (" + (h.timezone || "America/New_York") + ").",
    h.sport ? "The sport is " + h.sport + "." : "",
    h.myTeam ? "The user's team is \"" + h.myTeam + "\". Title games from their point of view: 'vs X' at home, '@ X' away." : "If multiple teams appear, list them all in teamsFound and fill homeTeam and awayTeam.",
    "Rules: never invent events. Keep each row's original text in sourceText. If the year is not printed, infer it: seasons that cross New Year roll the year over in January. Use 24 hour times. If a cell is hard to read or a value is a guess, lower confidence below 0.75. Practices are type practice, races are type race, tournaments, scrimmages, and parties are type event, everything else is game.",
    "Call save_schedule exactly once."
  ].filter(Boolean).join("\n");
  const block = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 4000, tools: [TOOL], tool_choice: { type: "tool", name: "save_schedule" }, messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }] })
    });
    const out = await r.json();
    if (!r.ok) return json({ error: "The AI reader had a problem (" + ((out.error && out.error.type) || r.status) + "). Try again or use a file.", detail: out.error && out.error.message }, 502);
    const tu = (out.content || []).find(c => c.type === "tool_use");
    if (!tu) return json({ error: "Couldn't find a schedule in that image." }, 422);
    return json({ ok: true, ...tu.input });
  } catch (e) {
    return json({ error: "Couldn't reach the AI reader. Check your connection and try again." }, 504);
  }
};
