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

/**
 * Pick one entry from a weighted table: [{ value, weight }, ...].
 * Weights need not sum to 1; a zero/negative total falls back to the
 * first entry. Used for mission-complete loot (missions.js).
 */
export function weightedPick(rng, entries) {
  let total = 0;
  for (const e of entries) total += Math.max(0, e.weight || 0);
  if (total <= 0) return entries[0] ? entries[0].value : null;
  let roll = rng.next() * total;
  for (const e of entries) {
    roll -= Math.max(0, e.weight || 0);
    if (roll <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

/**
 * v4 mission loot: what Leo pockets when a job pays off. Mostly ammo for
 * a weapon he already carries (the backpack earns its keep), sometimes a
 * cash bonus on top of the mission reward.
 */
export function randomLootDrop(rng) {
  const kind = weightedPick(rng, [
    { value: 'ammo', weight: 0.65 },
    { value: 'cash', weight: 0.25 },
    { value: 'ammo-big', weight: 0.1 },
  ]);
  if (kind === 'cash') return { kind: 'cash', amount: rng.int(25, 80) };
  if (kind === 'ammo-big') return { kind: 'ammo', amount: rng.int(24, 48) };
  return { kind: 'ammo', amount: rng.int(6, 18) };
}
