// A phone chime and a few soft key taps, made with Web Audio like the emote sounds. No files.

let ctx;
function tone(freq, start, length, type = "sine", volume = 0.1) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + length + 0.02);
  } catch { /* no audio available: silence is fine */ }
}

export function chime() {
  tone(1319, 0, 0.18);
  tone(1760, 0.12, 0.3);
}

export function tap(times = 6) {
  for (let i = 0; i < times; i++) tone(520 + (i % 3) * 60, i * 0.08, 0.05, "square", 0.04);
}
