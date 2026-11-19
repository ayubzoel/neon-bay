// Neon Bay — a small seeded random generator (mulberry32) so the world,
// the side quests and the screenshot scenes are reproducible from a seed.
export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
    /** Fisher-Yates shuffle, in place, driven by this rng (deterministic). */
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
  };
}

/** A uniformly random point inside a disc of radius r around (cx, cy). */
export function randomPointInDisc(rng, cx, cy, r) {
  const angle = rng.next() * Math.PI * 2;
  const dist = r * Math.sqrt(rng.next());
  return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
}

/** A uniformly random heading in radians, 0..2π. */
export function randomHeading(rng) {
  return rng.next() * Math.PI * 2;
}
