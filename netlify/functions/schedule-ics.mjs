// Turns events into a calendar file iPhone Safari can open with "Add All".
// POST (form field "events" = JSON array) or GET ?d=<base64url JSON>
const pad = n => String(n).padStart(2, "0");
const addMin = (t, n) => { const [h, m] = t.split(":").map(Number); const x = ((h * 60 + m + n) % 1440 + 1440) % 1440; return pad(Math.floor(x / 60)) + pad(x % 60); };
const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n").slice(0, 300);
const fold = l => { const o = []; while (l.length > 74) { o.push(l.slice(0, 74)); l = " " + l.slice(74); } o.push(l); return o.join("\r\n"); };
export default async (req) => {
  let raw = "";
  try {
    if (req.method === "POST") { const f = await req.formData(); raw = String(f.get("events") || "[]"); }
    else { const d = new URL(req.url).searchParams.get("d") || ""; raw = Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
  } catch { return new Response("Bad request", { status: 400 }); }
  let events; try { events = JSON.parse(raw); } catch { return new Response("Bad events", { status: 400 }); }
  if (!Array.isArray(events) || events.length > 300) return new Response("Bad events", { status: 400 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Game Shape//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Game Shape"];
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "")) continue;
    const d = e.date.replace(/-/g, ""), st = /^\d{2}:\d{2}$/.test(e.start || "") ? e.start : null;
    L.push("BEGIN:VEVENT", "UID:" + esc(e.id || d + Math.random().toString(36).slice(2)) + "@gameshape", "DTSTAMP:" + stamp);
    if (st) L.push("DTSTART:" + d + "T" + st.replace(":", "") + "00", "DTEND:" + d + "T" + (/^\d{2}:\d{2}$/.test(e.end || "") ? e.end.replace(":", "") : addMin(st, 60)) + "00");
    else L.push("DTSTART;VALUE=DATE:" + d);
    L.push(fold("SUMMARY:" + esc(e.title || "Event")));
    if (e.location) L.push(fold("LOCATION:" + esc(e.location)));
    L.push(fold("DESCRIPTION:" + esc(e.note || "Game Shape: electrolytes 60 min before, extra 5 min calf warmup.")));
    if (st) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(e.title || "Event"), "TRIGGER:-PT120M", "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return new Response(L.join("\r\n") + "\r\n", { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="game-shape-schedule.ics"', "Cache-Control": "no-store" } });
};
