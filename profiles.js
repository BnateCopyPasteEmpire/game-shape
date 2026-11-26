/* Game Shape people. Brett is the default app at "/". Everyone else gets their own link at "/<id>/".
   Each person's data saves on their own phone under their own storage key, so nobody's logs mix.
   To add a person: add an entry below, add "/<id>/*  /index.html  200" to _redirects, and copy manifest-mark.json to manifest-<id>.json. */
window.GS_PROFILES = {
  will: {
    id: "will",
    fullName: "Will Y.",
    badgeImg: "will-badge.jpg",
    theme: { accent: "#3ecf7a" },   // from intake: Green
    profile: { name: "Will", sport: "Basketball", team: "Easley Pres - B", age: 42, heightIn: 74, weight: 200, waist: 36, goalWeight: 185,
      protein: 165, waterBase: 80, waterCourtExtra: 20, calTrain: 2200, calCourt: 2400, fiber: 30 },
    programStart: "2026-11-23",
    supplements: [],
    appointments: [],
    readsSpicy: false,
    affirmations: [
      "I lead my team by how I take care of myself.",
      "Small wins every day. Down 15 and feeling good.",
      "I don't need perfect. I need to show up."
    ],
    custom: {
      times: { wake: "05:00", workout: "05:00", hottub: "05:45", breakfast: "06:30", lunch: "12:00", windDown: "21:00", read: "21:20", bed: "22:00" },
      features: { hotTub: false, runs: true },
      hide: { hottub: true },
      waterWakeOz: 16,
      wind: [
        { id: "wd_tv", time: "21:00", label: "Phone on charger. No screens" },
        { id: "wd_roll", time: "21:05", label: "Massage gun or foam roll 5 min: hips, groin, low back" },
        { id: "wd_stretch", time: "21:10", label: "Figure-4 + butterfly stretch 5 min" },
        { id: "wd_read", time: "21:20", label: "Read 15 min" },
        { id: "wd_pray", time: "21:40", label: "Prayer, breathing, or journal 5 min" },
        { id: "bed", time: "22:00", label: "In bed. Lights out by 10:15" }
      ],
      identity: [
        "Consistency beats intensity.",
        "Coach yourself like you coach your team.",
        "Easy pace, every week, all year.",
        "Less sore, more ready.",
        "Water first. Coffee second.",
        "One good choice, then the next one.",
        "Strong hips, quiet back."
      ]
    },
    onboard: true,
    setupMode: "locations",
    windowsDefault: ["5:00 AM", "6 to 9 PM"],
    homeEquipDefault: { equip: ["mb", "treadmill", "roller"], maxDB: null },   // from intake
    noMidday: true,
    maxSets: 2,
    highReps: true,
    weekPlan: { 0: "W_REST", 1: "W_UPPER", 2: "W_UPPER", 3: "W_FULL", 4: "W_RUN", 5: "W_LOWER", 6: "W_RUN" },
    gymSwap: { W_LOWER: "WG_LEGS", W_UPPER: "WG_UPPER", W_FULL: "WG_FULL" },
    heavyLegs: ["W_LOWER", "WG_LEGS"],
    preCourtSwap: "W_UPPER",
    practiceTpl: "W_PRACTICE",
    restTpl: "W_REST",
    restDays: [0]
  },
  mark: {
    id: "mark",
    fullName: "Mark L.",
    badgeImg: "mark-badge.jpg",
    theme: { accent: "#4cc9f0" },   // from intake: Ice blue
    profile: { name: "Mark", sport: "Basketball", team: "Easley Pres - B", age: 35, heightIn: 75, weight: 175, waist: 32,
      protein: 160, waterBase: 100, waterCourtExtra: 25, calTrain: 3000, calCourt: 3200, fiber: 34 },
    programStart: "2026-11-23",
    supplements: [],
    appointments: [],
    readsSpicy: false,
    affirmations: [
      "I show up, even on the days I don't feel like it.",
      "Every rep I do today builds the strongest version of me.",
      "I take care of my body so I can take care of my people."
    ],
    custom: {
      times: { wake: "05:30", workout: "06:00", hottub: "06:45", breakfast: "06:45", lunch: "12:00", windDown: "20:30", read: "20:50", bed: "21:30" },
      features: { hotTub: false },
      hide: { hottub: true },
      waterWakeOz: 16,
      wind: [
        { id: "wd_tv", time: "20:30", label: "Phone on charger. No screens" },
        { id: "wd_roll", time: "20:35", label: "Foam roll 10 min: calves, quads, upper back" },
        { id: "wd_stretch", time: "20:45", label: "Easy stretch 5 min" },
        { id: "wd_read", time: "20:50", label: "Read 15 min" },
        { id: "wd_pray", time: "21:05", label: "Prayer, breathing, or journal 5 min" },
        { id: "bed", time: "21:30", label: "In bed. Lights out by 9:45" }
      ],
      identity: [
        "Show up. Lift. Recover. Repeat.",
        "Strong arms are built one rep at a time.",
        "I'm building the body I want to hoop in.",
        "Consistency beats intensity.",
        "Every rep is a deposit.",
        "Rest is part of the work.",
        "Never miss twice."
      ]
    },
    // Training plan by weekday (0 = Sunday). Game and practice days override this automatically.
    weekPlan: { 0: "M_REST", 1: "M_UPPER_A", 2: "M_EASY", 3: "M_UPPER_B", 4: "M_EASY", 5: "M_LEGS", 6: "M_FULL" },
    heavyLegs: ["M_LEGS"],          // never the day before or day of a game or practice
    preCourtSwap: "M_UPPER_A",      // what a leg day becomes when court is tomorrow
    onboard: true,                  // asks the workout setup questions on next open
    setupMode: "locations",         // pick windows + where he trains (Home, Brett's Gym, YMCA)
    windowOpts: ["Morning (5 to 7 AM)", "Late afternoon (4 to 6 PM)", "After kids (8 to 10 PM)"],
    windowsDefault: ["Morning (5 to 7 AM)", "Late afternoon (4 to 6 PM)", "After kids (8 to 10 PM)"],
    maxWindows: 3,
    homeEquipDefault: { equip: ["db", "kb", "bike", "roller"], maxDB: 25 },   // from intake; he confirms on setup
    noMidday: true,
    practiceTpl: "M_PRACTICE",
    restTpl: "M_EASY",            // days he says he can't train: walk + mobility
    restDays: [0]                   // Sundays off: they never break the streak
  }
};
/* Brett keeps his own built-in plan at "/", but gets the same onboarding, setup questions, and welcome badge as everyone else. */
window.GS_SELF = {
  id: "brett",
  fullName: "Brett N.",
  badgeImg: "brett-badge.jpg",
  onboard: true,
  setupMode: "locations",
  windowsDefault: ["5:00 AM"],
  maxWindows: 2,
  locsDefault: ["brett", "ymca"],
  homeEquipDefault: { equip: ["db", "kb", "bench", "smith", "legmachine", "mb", "roller"], maxDB: 50 }
};
window.GS_PERSON = (function () {
  try {
    const seg = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    const q = (new URLSearchParams(location.search).get("u") || location.hash.replace("#", "")).toLowerCase();
    const id = window.GS_PROFILES[seg] ? seg : window.GS_PROFILES[q] ? q : null;
    return id ? window.GS_PROFILES[id] : null;
  } catch (e) { return null; }
})();
