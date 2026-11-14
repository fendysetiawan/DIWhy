// The story: starts when the page loads.
// Close on the house -> a few lines of narration -> the deed pops up ->
// sign it, press Start -> pull back to the sign as SOLD slaps onto it.

(() => {
  const story = document.getElementById("story");
  const camera = story.querySelector(".camera");
  const caption = story.querySelector(".caption");
  const captionText = story.querySelector(".caption-text");

  const BEFORE = [
    "Look at it.",
    "A wraparound porch. Original wood. Big old trees. It has character.",
    "Sure, it needs a little work. But you're handy. You've watched videos.",
  ];

  // Choices: what you picked is kept in `picks` for later scenes.
  const picks = {};
  const BUY = {
    key: "buy",
    question: "And it can all be yours for $750,000.",
    options: [
      { label: "Buy it", reply: [] },
      { label: "Get an inspection first", reply: [
        "The inspector takes one look, laughs, and leaves without sending a bill.",
        "That's probably a good sign.",
      ] },
      { label: "Walk away", reply: [
        "You try to walk away. Your feet won't move.",
        "The house has decided.",
      ] },
    ],
  };
  const FIRST_JOB = {
    key: "firstJob",
    question: "So. Where do you start?",
    options: [
      { label: "The saggy porch", reply: [
        "You lean on the railing to think about it. The railing thinks about it too, then lets go.",
      ] },
      { label: "The attic", reply: [
        "Something up there is already living rent-free. It has opinions about you.",
      ] },
      { label: "That wall looks unnecessary", reply: [
        "Bold. You find a sledgehammer in the shed. It feels... right.",
      ] },
    ],
  };
  const AFTER = ["How hard can it be?"];

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Type a line out, then wait for a click / key to move on.
  // A click while it's still typing finishes the line instead.
  function say(line) {
    caption.classList.add("on");
    caption.classList.remove("ready");
    captionText.textContent = "";
    return new Promise((resolve) => {
      let i = 0;
      let typing = true;
      const tick = setInterval(() => {
        captionText.textContent = line.slice(0, ++i);
        if (i >= line.length) finish();
      }, 28);
      function finish() {
        clearInterval(tick);
        captionText.textContent = line;
        typing = false;
        caption.classList.add("ready");
      }
      function next(e) {
        if (e.type === "keydown" && !["Enter", " ", "ArrowRight"].includes(e.key)) return;
        if (typing) return finish();
        window.removeEventListener("pointerdown", next);
        window.removeEventListener("keydown", next);
        resolve();
      }
      // attach on the next frame so the click that got us here doesn't count
      requestAnimationFrame(() => {
        window.addEventListener("pointerdown", next);
        window.addEventListener("keydown", next);
      });
    });
  }

  // Ask a question with buttons. Click one, or press 1 / 2 / 3.
  function choose({ key, question, options }) {
    caption.classList.add("on", "ready", "choosing");
    captionText.textContent = question;
    const row = document.createElement("div");
    row.className = "choices";
    return new Promise((resolve) => {
      const pick = (i) => {
        window.removeEventListener("keydown", onKey);
        row.remove();
        caption.classList.remove("choosing");
        picks[key] = options[i].label;
        resolve(options[i]);
      };
      const onKey = (e) => {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < options.length) pick(i);
      };
      options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.innerHTML = `<span class="choice-n">${i + 1}</span>`;
        b.append(o.label);
        b.addEventListener("click", () => pick(i));
        row.append(b);
      });
      caption.append(row);
      window.addEventListener("keydown", onKey);
    });
  }

  async function ask(q) {
    const choice = await choose(q);
    for (const line of choice.reply) await say(line);
  }

  async function play() {
    story.hidden = false;
    await wait(50);
    story.classList.add("on");          // fade up, close on the house
    await wait(1200);

    for (const line of BEFORE) await say(line);
    await ask(BUY);
    caption.classList.remove("on");

    await openDeed();                    // sign, then Start

    camera.classList.add("pull-back");   // reveal the sign...
    await wait(900);
    camera.classList.add("sold");        // ...SOLD!
    await wait(1100);

    await say("Congratulations. You own a house.");
    await ask(FIRST_JOB);
    for (const line of AFTER) await say(line);
    caption.classList.remove("on");
    window.dispatchEvent(new CustomEvent("story:done", { detail: picks }));
  }

  play();
})();
