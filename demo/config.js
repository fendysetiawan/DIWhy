// The demo's settings, in one place. Plain values, no DOM, so both the browser and the tests read them.
//
// The demo plays ONE fixed game so it tells the same story every time. If someone edits the dryer's
// events (or the consequences, or the quote) and the story stops being good, a test in
// backend/src/demo/demo.test.ts fails and says how to pick a new seed.

export const DEMO = {
  speed: 1.5, // how much faster than a person the demo plays

  // The fixed game: the plan's dryer chain (smoke, dust, wall, beehive) with the owner Gigi.
  seed: 0,
  owner: "gigi-singh", // a folder name in assets/characters
  project: "dryer-replacement", // a project id in backend/src/content/projects.ts
  spot: "dryer", // the glowing DIY spot that takes it on (frontend/index.html SPOTS; frontend/game-link.js maps it to the project)
  spotScene: "basement", // where that spot is, and where on that floor to stand next to it
  spotAt: [929, 800],

  // What it picks on each event card, by answer quality (the answer_key in events/*.csv). By step,
  // not by event, so editing events changes the story but never breaks the demo. It repeats.
  policy: ["good", "good", "wrong", "good", "ok", "excessive", "good", "good", "good"],
  finalePick: "ok", // the last step: finish it yourself (the risky one)

  // What a good demo story contains. A test replays the game and checks these; if an edit to the events
  // breaks one, it says how to pick a new seed.
  story: {
    mustSee: ["beehive_found", "cat_in_vent"], // the plan's showpiece, and the mascot
    minEvents: 7,
    minBlowups: 1, // at least one shortcut that gives way
    overrun: [1.1, 2.2], // ends this far over the contractor's quote (a multiple of it)
  },

  blockTheCardOnCharge: 3, // the third bank alert gets "No, block it." for drama
  askTheContractorAfterEvents: 3, // then it asks the contractor to update the quote
};
