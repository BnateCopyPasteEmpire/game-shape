// Game Shape weekly scoreboard: friendly competition between users.
// GET  /.netlify/functions/scoreboard?week=YYYY-MM-DD   -> { week, players: [{id,name,score,stats,updated}] }
// POST /.netlify/functions/scoreboard  {id, name, week, score, stats}
// Storage: Netlify Blobs store "scoreboard", one key per week (Monday date).
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const okWeek = w => /^\d{4}-\d{2}-\d{2}$/.test(String(w || ""));
const num = (v, max) => Math.max(0, Math.min(max, Math.round(+v || 0)));

export default async (req) => {
  const store = getStore("scoreboard");
  const url = new URL(req.url);
  if (req.method === "GET") {
    const week = url.searchParams.get("week");
    if (!okWeek(week)) return json({ error: "Bad week" }, 400);
    const data = (await store.get("week-" + week, { type: "json" })) || {};
    const players = Object.values(data).sort((a, b) => b.score - a.score);
    return json({ week, players });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const id = String(b.id || "").toLowerCase();
  if (!/^[a-z0-9-]{2,20}$/.test(id) || !okWeek(b.week)) return json({ error: "Bad request" }, 400);
  const s = b.stats || {};
  const rec = {
    id, name: String(b.name || id).replace(/[<>]/g, "").trim().slice(0, 20) || id,
    score: num(b.score, 2000),
    stats: { workouts: num(s.workouts, 7), quick: num(s.quick, 7), active: num(s.active, 7), water: num(s.water, 7), protein: num(s.protein, 7), readMin: num(s.readMin, 2000), sleep: num(s.sleep, 7), miles: Math.max(0, Math.min(200, Math.round((+s.miles || 0) * 10) / 10)) },
    updated: new Date().toISOString()
  };
  const key = "week-" + b.week, data = (await store.get(key, { type: "json" })) || {};
  data[id] = rec;
  await store.setJSON(key, data);
  return json({ ok: true, players: Object.values(data).sort((a, b) => b.score - a.score) });
};
