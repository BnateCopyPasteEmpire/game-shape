/* Game Shape people. Brett is the default app at "/". Everyone else gets their own link at "/<id>/".
   Each person's data saves on their own phone under their own storage key, so nobody's logs mix.
   To add a person: add an entry below, add "/<id>/*  /index.html  200" to _redirects, and copy manifest-mark.json to manifest-<id>.json. */
window.GS_PROFILES = {
  mark: {
    id: "mark",
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
    practiceTpl: "M_PRACTICE",
    restDays: [0]                   // Sundays off: they never break the streak
  }
};
window.GS_PERSON = (function () {
  try {
    const seg = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    const q = (new URLSearchParams(location.search).get("u") || location.hash.replace("#", "")).toLowerCase();
    const id = window.GS_PROFILES[seg] ? seg : window.GS_PROFILES[q] ? q : null;
    return id ? window.GS_PROFILES[id] : null;
  } catch (e) { return null; }
})();
