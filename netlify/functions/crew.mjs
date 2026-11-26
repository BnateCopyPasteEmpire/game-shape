// Game Shape crew check-ins: each person's workout setup (windows, places, home equipment), sent when they save it.
// POST /.netlify/functions/crew  {id, name, version, setup}
// GET  /.netlify/functions/crew?pin=ADMIN_PIN   -> { people: [...] }   (Brett only)
// Storage: Netlify Blobs store "crew", key "setups".
import { getStore } from "@netlify/blobs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, max) => String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, max);
const list = (a, n, max) => (Array.isArray(a) ? a : []).slice(0, n).map(x => clean(x, max));

export default async (req) => {
  const store = getStore("crew");
  const data = (await store.get("setups", { type: "json" })) || {};
  if (req.method === "GET") {
    const pin = new URL(req.url).searchParams.get("pin");
    if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) return json({ error: "PIN required" }, 401);
    return json({ people: Object.values(data).sort((a, b) => (b.updated || "").localeCompare(a.updated || "")) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const id = String(b.id || "").toLowerCase();
  if (!/^[a-z0-9-]{2,20}$/.test(id)) return json({ error: "Bad request" }, 400);
  const su = b.setup || {};
  const setup = { windows: list(su.windows, 6, 40), locs: list(su.locs, 5, 12), home: clean(su.home, 12) || null, equip: list(su.equip, 20, 16),
    maxDB: Math.max(0, Math.min(200, Math.round(+su.maxDB || 0))) || null, notes: clean(su.notes, 200), gym: !!su.gym, gymDays: (Array.isArray(su.gymDays) ? su.gymDays : []).slice(0, 7).map(n => Math.max(0, Math.min(6, Math.round(+n || 0)))),
    offDays: (Array.isArray(su.offDays) ? su.offDays : []).slice(0, 7).map(n => Math.max(0, Math.min(6, Math.round(+n || 0)))), miss: list(su.miss, 20, 14) };
  const prev = data[id];
  data[id] = { id, name: clean(b.name, 20) || id, version: clean(b.version, 12), updated: new Date().toISOString(), setup, history: [...((prev && prev.history) || []), ...(prev ? [{ updated: prev.updated, setup: prev.setup }] : [])].slice(-5) };
  await store.setJSON("setups", data);
  return json({ ok: true });
};
