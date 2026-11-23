// Fetches a calendar feed (ICS / webcal) for the app, because browsers block reading other sites directly.
// GET /.netlify/functions/schedule-fetch?url=https://...ics
const json = (b, s = 400) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const PRIVATE = [/^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^\[?::1\]?$/, /^\[?f[cd]/i, /\.local$/i, /\.internal$/i];
function check(raw) {
  let u; try { u = new URL(String(raw || "").trim().replace(/^webcals?:\/\//i, "https://")); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (PRIVATE.some(r => r.test(u.hostname))) return null;
  return u;
}
export default async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  let u = check(new URL(req.url).searchParams.get("url"));
  if (!u) return json({ error: "That link doesn't look like a calendar link. It should start with https:// or webcal://" });
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    let res;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "GameShape/2.2 (+calendar import)", Accept: "text/calendar, text/plain, */*" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop === 3) return json({ error: "Too many redirects." });
        u = check(new URL(res.headers.get("location"), u)); if (!u) return json({ error: "The link redirected somewhere unsafe." });
        continue;
      }
      break;
    }
    if (!res.ok) return json({ error: "The calendar site answered with error " + res.status + ". Check the link." }, 502);
    const len = +(res.headers.get("content-length") || 0); if (len > 1_000_000) return json({ error: "That calendar is too big (over 1 MB)." }, 413);
    const text = await res.text();
    if (text.length > 1_000_000) return json({ error: "That calendar is too big (over 1 MB)." }, 413);
    if (!/BEGIN:VCALENDAR/i.test(text)) return json({ error: "That link isn't a calendar feed. Look for an iCal, ICS, or 'subscribe' link." }, 422);
    return new Response(text, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return json({ error: e.name === "AbortError" ? "The calendar site took too long to answer." : "Couldn't reach that calendar." }, 504);
  } finally { clearTimeout(timer); }
};
