// Game Shape book quizzes: 3 basic multiple-choice questions per book, written once by Claude and cached for everyone.
// POST {action: "get", bookId, title, author, attempt, device}  -> { qid, questions: [{q, options}] }   (answers stay on the server)
// POST {action: "grade", bookId, qid, answers: [0..3, 0..3, 0..3]} -> { correct, total, pass }
// Needs ANTHROPIC_API_KEY. Optional ANTHROPIC_MODEL (default claude-haiku-5-5). Storage: Netlify Blobs store "quiz".
import { getStore } from "@netlify/blobs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v, max) => String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
const TOOL = {
  name: "save_quiz",
  description: "Save a 3-question multiple-choice quiz about the book.",
  input_schema: { type: "object", properties: { questions: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", properties: {
    q: { type: "string", description: "The question, one sentence." },
    options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
    answer: { type: "integer", minimum: 0, maximum: 3, description: "Index of the correct option." }
  }, required: ["q", "options", "answer"] } } }, required: ["questions"] }
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const bookId = clean(b.bookId, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!bookId) return json({ error: "Bad request" }, 400);
  const store = getStore("quiz");

  if (b.action === "grade") {
    const qid = clean(b.qid, 120), set = qid.startsWith(bookId + "-") ? await store.get(qid, { type: "json" }) : null;
    if (!set) return json({ error: "Quiz expired. Open it again." }, 404);
    const a = Array.isArray(b.answers) ? b.answers : [];
    const correct = set.questions.reduce((n, q, i) => n + (+a[i] === q.answer ? 1 : 0), 0);
    return json({ correct, total: set.questions.length, pass: correct >= 2, answers: correct >= 2 ? set.questions.map(q => q.answer) : undefined });
  }

  if (b.action !== "get") return json({ error: "Bad request" }, 400);
  const title = clean(b.title, 120), author = clean(b.author, 80);
  if (!title) return json({ error: "Missing title" }, 400);
  const slot = Math.max(0, Math.min(2, Math.round(+b.attempt || 0))) % 3, qid = bookId + "-v" + slot;
  let set = await store.get(qid, { type: "json" });
  if (!set) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json({ error: "Quizzes aren't turned on yet. Try again later.", code: "NO_KEY" }, 503);
    try {   // 15 new quizzes per device per day
      const day = new Date().toISOString().slice(0, 10), rk = "rate-" + clean(b.device, 60) + "-" + day, n = (await store.get(rk, { type: "json" })) || 0;
      if (n >= 15) return json({ error: "Daily quiz limit reached. Try tomorrow." }, 429);
      await store.setJSON(rk, n + 1);
    } catch {}
    const prompt = [
      `Write a 3-question multiple-choice quiz for someone who just finished the book "${title}"${author ? " by " + author : ""}.`,
      "Keep it basic: anyone who actually read the book should get all 3 right. Ask about (1) the main idea or plot, (2) a key person, character, or story from the book, (3) a core lesson or takeaway.",
      "Each question has 4 short options with exactly one correct answer. Wrong options must be clearly wrong to a reader but believable to a non-reader. No trick questions, no page numbers, no quotes, no dates.",
      slot ? "This is a retake: use different questions than an obvious first quiz would." : "",
      "If you don't know the book well, ask only about facts that are widely known from its description. Call save_quiz once."
    ].filter(Boolean).join("\n");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 1200, tools: [TOOL], tool_choice: { type: "tool", name: "save_quiz" }, messages: [{ role: "user", content: prompt }] })
      });
      const out = await r.json();
      if (!r.ok) return json({ error: "The quiz maker had a problem. Try again later." }, 502);
      const tu = (out.content || []).find(c => c.type === "tool_use");
      const qs = tu && tu.input && Array.isArray(tu.input.questions) ? tu.input.questions.slice(0, 3) : [];
      if (qs.length < 3 || qs.some(q => !Array.isArray(q.options) || q.options.length !== 4)) return json({ error: "Couldn't build a quiz for that book. Try again later." }, 422);
      set = { title, author, created: new Date().toISOString(), questions: qs.map(q => ({ q: clean(q.q, 300), options: q.options.map(o => clean(o, 160)), answer: Math.max(0, Math.min(3, +q.answer || 0)) })) };
      await store.setJSON(qid, set);
    } catch (e) {
      return json({ error: "Couldn't reach the quiz maker. Check your connection." }, 504);
    }
  }
  return json({ qid, questions: set.questions.map(q => ({ q: q.q, options: q.options })) });
};
