// Game Shape Good Reads: shared community recommendations.
// GET  /.netlify/functions/books           -> { items: [...visible] }   (?pin=ADMIN_PIN returns hidden too)
// POST /.netlify/functions/books  {title, author, category, why, link, recommendedBy, device}
// Storage: Netlify Blobs store "good-reads", key "community". Admin PIN lives in the ADMIN_PIN env var.
import { getStore } from "@netlify/blobs";

const CATS = ["mindset", "discipline", "masculinity", "sales", "money", "training", "body", "nutrition", "sleep", "biography", "history", "strategy", "romance"];
const BAD = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard", "porn"];
const clean = (v, max) => String(v || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const store = getStore("good-reads");
  const items = (await store.get("community", { type: "json" })) || [];
  const url = new URL(req.url);
  const isAdmin = !!process.env.ADMIN_PIN && url.searchParams.get("pin") === process.env.ADMIN_PIN;

  if (req.method === "GET") return json({ items: isAdmin ? items : items.filter(i => !i.hidden) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const rec = {
    title: clean(b.title, 120), author: clean(b.author, 80), why: clean(b.why, 280),
    category: CATS.includes(b.category) ? b.category : "mindset",
    link: /^https?:\/\/[^\s]+$/i.test(String(b.link || "")) ? String(b.link).slice(0, 300) : "",
    recommendedBy: clean(b.recommendedBy, 30) || "Friend"
  };
  if (!rec.title || !rec.author) return json({ error: "Title and author are required." }, 400);
  const text = (rec.title + " " + rec.author + " " + rec.why).toLowerCase();
  if (BAD.some(w => text.includes(w))) return json({ error: "Please keep it clean." }, 400);
  if (items.some(i => i.title.toLowerCase() === rec.title.toLowerCase() && i.author.toLowerCase() === rec.author.toLowerCase()))
    return json({ error: "That book is already on the community list." }, 409);

  // Rate limit: 5 recommendations per device per day.
  const device = clean(b.device, 60) || "anon", day = new Date().toISOString().slice(0, 10);
  const rk = "rate-" + device + "-" + day, count = (await store.get(rk, { type: "json" })) || 0;
  if (count >= 5) return json({ error: "Daily limit reached. Try again tomorrow." }, 429);
  await store.setJSON(rk, count + 1);

  const item = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: day, hidden: false, promoted: false }, rec);
  items.unshift(item);
  await store.setJSON("community", items.slice(0, 500));
  return json({ ok: true, id: item.id });
};
