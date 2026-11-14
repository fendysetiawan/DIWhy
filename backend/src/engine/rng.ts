// Seeded random numbers (mulberry32). Same seed in, same sequence out.

export type Rng = () => number; // returns a float in [0, 1)

/** An Rng that can report where it is, so a game can be saved and resumed exactly. */
export type StatefulRng = Rng & { state(): number };

/**
 * `createRng(seed)` starts a sequence. `createRng(rng.state())` resumes it from that point:
 * the generator's whole state is one 32-bit number, and a fresh generator starts with the seed.
 */
export function createRng(seedOrState: number): StatefulRng {
  let a = seedOrState >>> 0;
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as StatefulRng;
  next.state = () => a;
  return next;
}
