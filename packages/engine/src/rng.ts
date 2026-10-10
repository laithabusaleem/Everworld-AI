/** Seedable Mulberry32 PRNG for deterministic rule-based runs. */
export type Rng = {
  next: () => number;
  int: (min: number, maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  seed: number;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (min, maxExclusive) =>
      min + Math.floor(next() * (maxExclusive - min)),
    pick: <T>(items: readonly T[]) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from empty list");
      }
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
