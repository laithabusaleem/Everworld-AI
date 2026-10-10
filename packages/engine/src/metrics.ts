import type { MetricsSnapshot, WorldState } from "./schemas.js";

export function collectMetrics(state: WorldState): MetricsSnapshot {
  const population = state.characters.length;
  let totalFood = 0;
  let totalResources = 0;
  let hungerSum = 0;
  let trustSum = 0;
  let trustCount = 0;
  let allianceCount = 0;

  for (const c of state.characters) {
    totalFood += c.inventory.food ?? 0;
    for (const v of Object.values(c.inventory)) totalResources += v;
    hungerSum += c.needs.hunger;
    for (const r of c.relationships) {
      trustSum += r.trust;
      trustCount += 1;
      if (r.alliance) allianceCount += 1;
    }
  }
  for (const r of state.resources) {
    totalResources += r.amount;
    if (r.kind === "food") totalFood += r.amount;
  }

  // Count conflict-related feed entries this tick
  const conflictEvents = state.feed.filter(
    (f) => f.tick === state.tick && f.severity !== "info",
  ).length;

  // Also count high-conflict relationships as structural tension
  const highConflict = state.characters.reduce(
    (n, c) => n + c.relationships.filter((r) => r.conflict >= 40).length,
    0,
  );

  return {
    tick: state.tick,
    population,
    totalFood,
    totalResources,
    allianceCount: Math.floor(allianceCount / 2),
    conflictEvents: conflictEvents + highConflict,
    averageHunger: population ? hungerSum / population : 0,
    averageTrust: trustCount ? trustSum / trustCount : 0,
  };
}
