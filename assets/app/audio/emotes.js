// Placeholder emote sounds, one per character. No audio files: each one is a
// tiny 8-bit jingle made with the Web Audio API. Swap these for real recordings
// later by changing playEmote().
//
// Usage: playEmote("aidan-newsome")

// Each note: [frequency in Hz, length in seconds, wave, optional slide-to Hz]
const EMOTES = {
  // a low, unimpressed "hm-hmm"
  "travis-potter": [[196, 0.12, "square"], [147, 0.22, "square"]],
  // an upbeat "let's go!" climb
  "aidan-newsome": [[523, 0.07, "triangle"], [659, 0.07, "triangle"], [784, 0.07, "triangle"], [1047, 0.16, "triangle"]],
  // a quick bright chirp
  "rachel-katz": [[880, 0.06, "sine"], [1175, 0.06, "sine"], [1568, 0.12, "sine"]],
  // a steady "yep, yep"
  "christian-huber": [[440, 0.08, "square"], [0, 0.05], [440, 0.12, "square"]],
  // a laid-back slide up
  "ramy-maher": [[220, 0.32, "sawtooth", 440]],
  // a sparkly arpeggio
  "gigi-singh": [[1319, 0.05, "sine"], [1568, 0.05, "sine"], [1976, 0.05, "sine"], [2637, 0.14, "sine"]],
  // a bouncy up-and-down
  "fendy-seitiawan": [[523, 0.06, "square"], [784, 0.06, "square"], [659, 0.06, "square"], [1047, 0.12, "square"]],
};

const VOLUME = 0.12;
let ctx = null;

function audio() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function playEmote(id) {
  const notes = EMOTES[id];
  if (!notes) return;
  const ac = audio();
  let t = ac.currentTime + 0.01;
  for (const [freq, len, wave = "square", slideTo] of notes) {
    if (freq > 0) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + len);
      // quick fade in and out so notes don't click
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(VOLUME, t + 0.005);
      gain.gain.setValueAtTime(VOLUME, t + len - 0.02);
      gain.gain.linearRampToValueAtTime(0, t + len);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + len + 0.01);
    }
    t += len;
  }
}
