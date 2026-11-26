// Game Shape scoreboard: weekly points and 3-month season standings.
// GET  /.netlify/functions/scoreboard?week=YYYY-MM-DD&season=S1   -> { week, players, season, standings, prize }
// POST /.netlify/functions/scoreboard  {id, name, accent, week, score, stats, season: {id, points, tot, badges, miles, books}}
// POST /.netlify/functions/scoreboard  {action: "prize", pin, season, text}   (Brett only, ADMIN_PIN)
// Storage: Netlify Blobs store "scoreboard": "week-YYYY-MM-DD", "season-S1", "prize-S1".
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const okWeek = w => /^\d{4}-\d{2}-\d{2}$/.test(String(w || ""));
const okSeason = s => /^S\d{1,3}$/.test(String(s || ""));
const num = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));
const DEFAULT_PRIZE = "The first-ever Game Shape T-shirt and matching beanie";
const byScore = (a, b) => b.score - a.score;
const CATS = ["workout", "court", "run", "water", "protein", "sleep", "affirm", "read", "bonus"], CHECKS = ["workout", "water", "sleep", "read", "affirm", "allIn"];
function weeks(w) {
  const out = {}; if (!w || typeof w !== "object") return out;
  Object.keys(w).filter(okWeek).sort().slice(-20).forEach(ws => { const x = w[ws] || {}; out[ws] = { hits: num(x.hits, 28), tier: TV[x.tier] != null ? x.tier : null }; });
  return out;
}
function today(t) {
  if (!t || !okWeek(t.date)) return null;
  const cats = {}, checks = {}; CATS.forEach(k => { cats[k] = num((t.cats || {})[k], 500); }); CHECKS.forEach(k => { checks[k] = !!(t.checks || {})[k]; });
  return { date: t.date, pts: num(t.pts, 2000), cats, checks };
}

/* Golden Tropics Basketball badge: for each finished month, the best weekly medal total (Gold 3, Silver 2, Bronze 1, Poop 0) wins +300. Ties share it.
   A week belongs to the month its Thursday falls in. */
const TV = { gold: 3, silver: 2, bronze: 1, poop: 0 }, GOLDEN = 300;
function thursdayMonth(ws) { const d = new Date(ws + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 3); return d.toISOString().slice(0, 7); }
function goldens(recs) {
  const nowM = new Date().toISOString().slice(0, 7), by = {};
  recs.forEach(r => Object.entries(r.weeks || {}).forEach(([ws, w]) => { if (!w || !w.tier) return; const m = thursdayMonth(ws); if (m >= nowM) return; by[m] = by[m] || {}; const e = by[m][r.id] = by[m][r.id] || { v: 0, h: 0 }; e.v += TV[w.tier] || 0; e.h += +w.hits || 0; }));
  const out = {};
  for (const m in by) { const es = Object.entries(by[m]); const best = Math.max(...es.map(([, e]) => e.v)); if (best <= 0) continue; const top = es.filter(([, e]) => e.v === best), bh = Math.max(...top.map(([, e]) => e.h)); out[m] = top.filter(([, e]) => e.h === bh).map(([id]) => id); }
  return out;
}
async function read(store, week, season) {
  const out = {};
  if (okWeek(week)) out.players = Object.values((await store.get("week-" + week, { type: "json" })) || {}).sort(byScore);
  if (okSeason(season)) {
    const recs = Object.values((await store.get("season-" + season, { type: "json" })) || {});
    out.goldens = goldens(recs);
    recs.forEach(r => { const n = Object.values(out.goldens).filter(ids => ids.includes(r.id)).length; r.goldenCount = n; r.points = (r.points || 0) + n * GOLDEN; });
    out.standings = recs.sort((a, b) => b.points - a.points);
    out.prize = (await store.get("prize-" + season, { type: "json" })) || DEFAULT_PRIZE;
  }
  return out;
}

export default async (req) => {
  const store = getStore("scoreboard");
  const url = new URL(req.url);
  if (req.method === "GET") return json({ week: url.searchParams.get("week"), season: url.searchParams.get("season"), ...(await read(store, url.searchParams.get("week"), url.searchParams.get("season"))) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  if (b.action === "prize") {
    if (!process.env.ADMIN_PIN || b.pin !== process.env.ADMIN_PIN) return json({ error: "Wrong PIN" }, 401);
    if (!okSeason(b.season)) return json({ error: "Bad season" }, 400);
    await store.setJSON("prize-" + b.season, String(b.text || "").replace(/[<>]/g, "").trim().slice(0, 140) || DEFAULT_PRIZE);
    return json({ ok: true, ...(await read(store, null, b.season)) });
  }

  const id = String(b.id || "").toLowerCase();
  if (!/^[a-z0-9-]{2,20}$/.test(id) || !okWeek(b.week)) return json({ error: "Bad request" }, 400);
  const name = String(b.name || id).replace(/[<>]/g, "").trim().slice(0, 20) || id;
  const accent = /^#[0-9a-f]{6}$/i.test(String(b.accent || "")) ? b.accent : "#ff8200";
  const s = b.stats || {};
  const rec = {
    id, name, accent, score: num(b.score, 3000),
    stats: { workouts: num(s.workouts, 7), quick: num(s.quick, 7), active: num(s.active, 7), water: num(s.water, 7), protein: num(s.protein, 7), readMin: num(s.readMin, 2000), sleep: num(s.sleep, 7), miles: Math.max(0, Math.min(200, Math.round((+s.miles || 0) * 10) / 10)) },
    updated: new Date().toISOString()
  };
  const wk = "week-" + b.week, wdata = (await store.get(wk, { type: "json" })) || {};
  wdata[id] = rec; await store.setJSON(wk, wdata);

  const se = b.season;
  if (se && okSeason(se.id)) {
    const t = se.tot || {}, cats = ["workout", "court", "run", "water", "protein", "sleep", "affirm", "read", "bonus", "books", "badges"], tot = {};
    cats.forEach(k => { tot[k] = num(t[k], 20000); });
    const sk = "season-" + se.id, sdata = (await store.get(sk, { type: "json" })) || {};
    sdata[id] = { id, name, accent, points: num(se.points, 60000), tot, badges: (Array.isArray(se.badges) ? se.badges : []).slice(0, 40).map(x => String(x).slice(0, 12)),
      miles: Math.max(0, Math.min(3000, Math.round((+se.miles || 0) * 10) / 10)), books: num(se.books, 100), allInDays: num(se.allInDays, 400),
      today: today(se.today), weekPts: num(se.weekPts, 5000), weekHits: num(se.weekHits, 28), weeks: weeks(se.weeks), badgesToday: (Array.isArray(se.badgesToday) ? se.badgesToday : []).slice(0, 20).map(x => String(x).slice(0, 12)),
      lifetime: num(se.lifetime, 5000), allInEver: num(se.allInEver, 5000), updated: rec.updated };
    await store.setJSON(sk, sdata);
  }
  return json({ ok: true, ...(await read(store, b.week, se && se.id)) });
};
