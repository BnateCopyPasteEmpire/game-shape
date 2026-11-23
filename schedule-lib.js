/* Game Shape schedule library (shared by index.html and intake.html, and testable in Node).
   Parses ICS and CSV schedules into plain events, and builds ICS files for phone calendars.
   Event shape: { uid, date:"YYYY-MM-DD", start:"HH:MM"|null, end:"HH:MM"|null, title, opponent, homeAway, location, type, allDay } */
(function (root) {
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const hm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  /* ---------- dates + times ---------- */
  function inferYear(m, d, today) {
    today = today || new Date();
    let y = today.getFullYear();
    const cand = new Date(y, m - 1, d);
    if ((today - cand) / 864e5 > 60) y += 1;          // more than 2 months ago: it's next season
    else if ((cand - today) / 864e5 > 300) y -= 1;    // way in the future: it was last year
    return y;
  }
  function valid(y, m, d) { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d; }
  function out(y, m, d) { return valid(y, m, d) ? y + "-" + pad(m) + "-" + pad(d) : null; }
  function parseDate(str, today) {
    if (!str) return null;
    let s = String(str).trim().toLowerCase().replace(/\(.*?\)/g, " ").replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b\.?,?/g, " ").replace(/\s+/g, " ").trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return out(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return out(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/))) { let y = +m[3]; if (y < 100) y += 2000; return out(y, +m[1], +m[2]); }
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})\b/))) return out(inferYear(+m[1], +m[2], today), +m[1], +m[2]);
    if ((m = s.match(/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? ?(\d{4})?/))) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3)); if (mi < 0) return null;
      const y = m[3] ? +m[3] : inferYear(mi + 1, +m[2], today); return out(y, mi + 1, +m[2]);
    }
    if ((m = s.match(/^(\d{1,2}) ([a-z]{3,9})\.?,? ?(\d{4})?/))) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3)); if (mi < 0) return null;
      const y = m[3] ? +m[3] : inferYear(mi + 1, +m[1], today); return out(y, mi + 1, +m[1]);
    }
    return null;
  }
  function parseTime(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase().replace(/\s+/g, "");
    if (!s || /tbd|tba/.test(s)) return null;
    let m = s.match(/^(\d{1,2})(?::?(\d{2}))?(?::\d{2})?(a|p|am|pm|a\.m\.|p\.m\.)?$/);
    if (!m) { m = s.match(/(\d{1,2})(?::(\d{2}))?(am|pm|a|p)/); if (!m) return null; }
    let h = +m[1], mi = m[2] ? +m[2] : 0; const ap = m[3] ? m[3][0] : null;
    if (!m[2] && !ap && String(m[1]).length > 2) return null;
    if (ap === "p" && h < 12) h += 12; if (ap === "a" && h === 12) h = 0;
    if (h > 23 || mi > 59) return null;
    return pad(h) + ":" + pad(mi);
  }
  const addMin = (t, n) => { if (!t) return null; let [h, m] = t.split(":").map(Number); let x = h * 60 + m + n; x = ((x % 1440) + 1440) % 1440; return pad(Math.floor(x / 60)) + ":" + pad(x % 60); };
  function typeFromText(t) {
    const s = String(t || "").toLowerCase();
    if (/practice|training|workout|shootaround|lift\b/.test(s)) return "practice";
    if (/\brace\b|marathon|\b5k\b|\b10k\b|half|triathlon|ultra|gran fondo/.test(s)) return "race";
    if (/tournament|tourney|scrimmage|meet\b|event|clinic|tryout|banquet|party|dinner/.test(s)) return "event";
    return "game";
  }

  /* ---------- time zones (TZID in ICS) ---------- */
  function tzOffsetMs(utcMs, tz) {
    try {
      const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const p = {}; f.formatToParts(new Date(utcMs)).forEach(x => p[x.type] = x.value);
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs;
    } catch (e) { return null; }
  }
  function zonedToDate(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
    const o1 = tzOffsetMs(guess, tz); if (o1 == null) return new Date(y, mo - 1, d, h, mi, s || 0);
    const o2 = tzOffsetMs(guess - o1, tz);
    return new Date(guess - (o2 == null ? o1 : o2));
  }
  function icsDate(val, params) {
    const v = String(val).trim();
    const tz = (params.match(/TZID=([^;:]+)/i) || [])[1];
    if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) { const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8); return { date: out(y, m, d), time: null, allDay: true, dt: new Date(y, m - 1, d) }; }
    const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/); if (!m) return null;
    const [Y, M, D, H, MI, S] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
    const dt = m[7] ? new Date(Date.UTC(Y, M - 1, D, H, MI, S)) : tz ? zonedToDate(Y, M, D, H, MI, S, tz.replace(/"/g, "")) : new Date(Y, M - 1, D, H, MI, S);
    return { date: ymd(dt), time: hm(dt), allDay: false, dt };
  }
  const unesc = s => String(s || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

  /* ---------- ICS ---------- */
  function parseICS(text, opts) {
    opts = opts || {}; const horizon = opts.horizonDays || 240;
    const lines = String(text).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const evs = []; let cur = null;
    for (const raw of lines) {
      const line = raw.trimEnd(); if (!line) continue;
      if (/^BEGIN:VEVENT/i.test(line)) { cur = { exdates: [] }; continue; }
      if (/^END:VEVENT/i.test(line)) { if (cur) evs.push(cur); cur = null; continue; }
      if (!cur) continue;
      const i = line.indexOf(":"); if (i < 0) continue;
      const head = line.slice(0, i), val = line.slice(i + 1), name = head.split(";")[0].toUpperCase(), params = head.slice(name.length);
      if (name === "DTSTART") cur.start = icsDate(val, params);
      else if (name === "DTEND") cur.end = icsDate(val, params);
      else if (name === "SUMMARY") cur.title = unesc(val);
      else if (name === "LOCATION") cur.location = unesc(val);
      else if (name === "DESCRIPTION") cur.description = unesc(val);
      else if (name === "UID") cur.uid = val.trim();
      else if (name === "STATUS") cur.status = val.trim().toUpperCase();
      else if (name === "RRULE") cur.rrule = val.trim();
      else if (name === "EXDATE") val.split(",").forEach(x => { const d = icsDate(x, params); if (d) cur.exdates.push(d.date); });
    }
    const res = [];
    const now = opts.today || new Date(), limit = new Date(now.getTime() + horizon * 864e5);
    for (const e of evs) {
      if (!e.start || !e.start.date || e.status === "CANCELLED") continue;
      const durMin = e.end && e.end.dt && !e.start.allDay ? Math.round((e.end.dt - e.start.dt) / 6e4) : 60;
      const base = { uid: e.uid || null, title: e.title || "Event", location: e.location || "", description: e.description || "", allDay: e.start.allDay };
      const mk = (dt, k) => {
        const date = ymd(dt); if (e.exdates.includes(date)) return;
        const start = e.start.allDay ? null : hm(dt);
        res.push(Object.assign({}, base, { uid: base.uid ? base.uid + (k ? "#" + date : "") : null, date, start, end: start ? addMin(start, durMin) : null, type: typeFromText(base.title + " " + base.description) }));
      };
      if (!e.rrule) { mk(e.start.dt, 0); continue; }
      const r = {}; e.rrule.split(";").forEach(p => { const [k, v] = p.split("="); r[k.toUpperCase()] = v; });
      if (!/WEEKLY|DAILY/.test(r.FREQ || "")) { mk(e.start.dt, 0); continue; }
      const count = r.COUNT ? +r.COUNT : Infinity, interval = +(r.INTERVAL || 1);
      const until = r.UNTIL ? (icsDate(r.UNTIL, "") || {}).dt : null;
      const days = r.BYDAY ? r.BYDAY.split(",").map(x => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(x.slice(-2))) : [e.start.dt.getDay()];
      let n = 0, d = new Date(e.start.dt);
      const ws = new Date(d); ws.setDate(ws.getDate() - ws.getDay());
      for (let i = 0; i < 1000 && n < count; i++) {
        const day = new Date(d); day.setDate(d.getDate() + i);
        if (until && day > until) break; if (day > limit) break;
        const weeks = Math.floor((day - ws) / (7 * 864e5));
        const hit = r.FREQ === "DAILY" ? (i % interval === 0) : (days.includes(day.getDay()) && weeks % interval === 0);
        if (hit) { n++; mk(day, 1); }
      }
    }
    return res.sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const t = String(text).replace(/^﻿/, "");
    const first = t.split(/\r?\n/).find(l => l.trim()) || "";
    const delim = [",", ";", "\t"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(f.trim()); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f.trim()); f = ""; if (row.some(x => x !== "")) rows.push(row); row = []; }
      else f += c;
    }
    row.push(f.trim()); if (row.some(x => x !== "")) rows.push(row);
    return rows;
  }
  const HEAD = {
    date: ["date", "game date", "event date", "day", "start date"],
    time: ["time", "start", "start time", "game time", "begins"],
    end: ["end", "end time", "finish"],
    home: ["home", "home team"],
    away: ["away", "away team", "visitor", "visitors"],
    opponent: ["opponent", "vs", "versus", "against"],
    title: ["title", "event", "name", "summary", "subject", "event name"],
    location: ["location", "gym", "field", "venue", "facility", "court", "where", "arena", "rink", "site"],
    type: ["type", "event type", "category", "kind"]
  };
  function detectColumns(rows) {
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const h = rows[r].map(x => x.toLowerCase().replace(/[^a-z ]/g, "").trim()), map = {};
      for (const k in HEAD) { const i = h.findIndex(x => HEAD[k].includes(x)); if (i >= 0) map[k] = i; }
      if (map.date != null) return { headerRow: r, map, headers: rows[r], confident: true };
    }
    // no header: guess by content of first data row
    const r0 = rows[0] || [], map = {};
    r0.forEach((v, i) => { if (map.date == null && parseDate(v)) map.date = i; else if (map.time == null && parseTime(v)) map.time = i; });
    return { headerRow: -1, map, headers: r0.map((_, i) => "Column " + (i + 1)), confident: false };
  }
  function teamsFromRows(rows, det) {
    const { map, headerRow } = det; if (map.home == null || map.away == null) return [];
    const c = {}; rows.slice(headerRow + 1).forEach(r => [r[map.home], r[map.away]].forEach(x => { if (x) c[x] = (c[x] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  function csvToEvents(rows, det, opts) {
    opts = opts || {}; const { map, headerRow } = det, my = (opts.myTeam || "").toLowerCase(), out = [];
    rows.slice(headerRow + 1).forEach((r, idx) => {
      const date = parseDate(r[map.date], opts.today); if (!date) return;
      const start = map.time != null ? parseTime(r[map.time]) : null;
      let end = map.end != null ? parseTime(r[map.end]) : null;
      let title = map.title != null ? r[map.title] : "", opponent = map.opponent != null ? r[map.opponent] : "", homeAway = null;
      if (map.home != null && map.away != null) {
        const H = r[map.home] || "", A = r[map.away] || "";
        if (my && H.toLowerCase() === my) { homeAway = "home"; opponent = A; }
        else if (my && A.toLowerCase() === my) { homeAway = "away"; opponent = H; }
        else if (my) return;  // not this team's game
        else { opponent = A; title = title || H + " vs " + A; }
      }
      if (!title) title = opponent ? (homeAway === "away" ? "@ " + opponent : "vs " + opponent) : "Event";
      const type = map.type != null && r[map.type] ? typeFromText(r[map.type]) : typeFromText(title);
      if (!end && start) end = addMin(start, type === "practice" ? 90 : 60);
      out.push({ uid: null, date, start, end, title, opponent: opponent || "", homeAway, location: map.location != null ? r[map.location] || "" : "", type, allDay: !start, row: idx });
    });
    return out;
  }

  /* ---------- ICS export ---------- */
  function icsEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }
  function fold(l) { const o = []; while (l.length > 74) { o.push(l.slice(0, 74)); l = " " + l.slice(74); } o.push(l); return o.join("\r\n"); }
  function toICS(events, opts) {
    opts = opts || {}; const alarm = opts.alarmMin == null ? 120 : opts.alarmMin;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Game Shape//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + icsEsc(opts.calName || "Game Shape")];
    events.forEach(e => {
      const d = e.date.replace(/-/g, "");
      L.push("BEGIN:VEVENT", "UID:" + (e.id || e.uid || d + Math.random().toString(36).slice(2)) + "@gameshape", "DTSTAMP:" + stamp);
      if (e.start) { L.push("DTSTART:" + d + "T" + e.start.replace(":", "") + "00", "DTEND:" + d + "T" + (e.end || addMin(e.start, 60)).replace(":", "") + "00"); }
      else { const n = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1); L.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + ymd(n).replace(/-/g, "")); }
      L.push(fold("SUMMARY:" + icsEsc(e.title || "Event")));
      if (e.location) L.push(fold("LOCATION:" + icsEsc(e.location)));
      L.push(fold("DESCRIPTION:" + icsEsc(e.note || opts.note || "Electrolytes 60 min before. Extra 5 min calf warmup.")));
      if (alarm && e.start) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(e.title || "Event"), "TRIGGER:-PT" + alarm + "M", "END:VALARM");
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  }

  /* ---------- duplicates ---------- */
  const norm = s => String(s || "").toLowerCase().replace(/^(vs\.?|@|at)\s+/, "").replace(/[^a-z0-9]/g, "");
  function sameEvent(a, b) {
    if (a.uid && b.uid) return a.uid === b.uid;
    if (a.date !== b.date) return false;
    const tm = t => t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null;
    const ta = tm(a.start), tb = tm(b.start);
    const timeOk = ta == null || tb == null || Math.abs(ta - tb) <= 30;
    const na = norm(a.opponent || a.title), nb = norm(b.opponent || b.title);
    return timeOk && (na === nb || (na && nb && (na.includes(nb) || nb.includes(na))));
  }
  function hashEvents(evs) { let h = 0; const s = JSON.stringify(evs.map(e => [e.uid, e.date, e.start, e.title, e.location])); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }

  const API = { parseDate, parseTime, addMin, typeFromText, parseICS, parseCSV, detectColumns, teamsFromRows, csvToEvents, toICS, sameEvent, hashEvents, HEAD };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.GS_SCHED = API;
})(typeof window !== "undefined" ? window : globalThis);
