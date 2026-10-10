import { retrieveRelevantMemories } from "./memory.js";
import type {
  Action,
  Character,
  Observation,
  TerrainType,
  WorldState,
} from "./schemas.js";
import { listLegalActions } from "./actions.js";

const VISION = 2;

export function observe(state: WorldState, actor: Character): Observation {
  const localTerrain: Observation["localTerrain"] = [];
  for (let dy = -VISION; dy <= VISION; dy++) {
    for (let dx = -VISION; dx <= VISION; dx++) {
      const x = actor.x + dx;
      const y = actor.y + dy;
      if (x < 0 || y < 0 || x >= state.settings.width || y >= state.settings.height) {
        continue;
      }
      const terrain = state.terrain[y]?.[x] as TerrainType | undefined;
      if (terrain) {
        localTerrain.push({ x, y, terrain });
      }
    }
  }

  const nearbyCharacters = state.characters
    .filter(
      (c) =>
        c.id !== actor.id &&
        Math.abs(c.x - actor.x) <= VISION &&
        Math.abs(c.y - actor.y) <= VISION,
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      x: c.x,
      y: c.y,
      role: c.role,
    }));

  const nearbyResources = state.resources.filter(
    (r) =>
      Math.abs(r.x - actor.x) <= VISION &&
      Math.abs(r.y - actor.y) <= VISION &&
      r.amount > 0,
  );

  const nearbyLocations = state.locations.filter(
    (l) =>
      Math.abs(l.x - actor.x) <= VISION && Math.abs(l.y - actor.y) <= VISION,
  );

  const subjects = [
    ...nearbyCharacters.map((c) => c.id),
    ...nearbyLocations.map((l) => l.id),
    ...actor.goals,
  ];

  const publicEvents = state.events.filter(
    (e) =>
      e.public &&
      e.tick <= state.tick &&
      (!e.locationId ||
        nearbyLocations.some((l) => l.id === e.locationId) ||
        actor.knownFacts.includes(e.id)),
  );

  const legalActions: Action[] = listLegalActions(state, actor);

  return {
    actorId: actor.id,
    tick: state.tick,
    position: { x: actor.x, y: actor.y },
    localTerrain,
    nearbyCharacters,
    nearbyResources,
    nearbyLocations,
    needs: actor.needs,
    inventory: actor.inventory,
    goals: actor.goals,
    relevantMemories: retrieveRelevantMemories(actor, subjects),
    relationships: actor.relationships,
    legalActions,
    knownFacts: actor.knownFacts,
    publicEvents,
  };
}
