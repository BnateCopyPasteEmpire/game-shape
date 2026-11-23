// Brett-only moderation. POST { pin, id, action: "hide" | "unhide" | "promote" | "unpromote" | "delete" }
import { getStore } from "@netlify/blobs";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (!process.env.ADMIN_PIN || b.pin !== process.env.ADMIN_PIN) return json({ error: "Wrong PIN" }, 401);
  const store = getStore("good-reads");
  let items = (await store.get("community", { type: "json" })) || [];
  const i = items.findIndex(x => x.id === b.id);
  if (i < 0) return json({ error: "Not found" }, 404);
  if (b.action === "delete") items.splice(i, 1);
  else if (b.action === "hide") items[i].hidden = true;
  else if (b.action === "unhide") items[i].hidden = false;
  else if (b.action === "promote") items[i].promoted = true;
  else if (b.action === "unpromote") items[i].promoted = false;
  else return json({ error: "Unknown action" }, 400);
  await store.setJSON("community", items);
  return json({ ok: true });
};
