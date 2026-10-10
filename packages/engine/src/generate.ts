import { createCoastalVillageBlueprint } from "./examples/coastalVillage.js";
import { createRng } from "./rng.js";
import type { TerrainType, WorldBlueprint, WorldState } from "./schemas.js";
import { WorldBlueprintSchema, WorldStateSchema } from "./schemas.js";

export type GenerateWorldInput = {
  description: string;
  seed?: number;
  name?: string;
};

/**
 * Rule-based world generation from a free-text description.
 * Extracts keywords and adapts the coastal template (or a sparse grid).
 */
export function generateWorldRules(input: GenerateWorldInput): WorldBlueprint {
  const seed = input.seed ?? hashString(input.description);
  const rng = createRng(seed);
  const text = input.description.toLowerCase();

  const base = createCoastalVillageBlueprint(seed);
  const foodScarcity = clamp(
    (text.includes("scarce") || text.includes("famine") ? 0.7 : 0.4) +
      (text.includes("abundant") ? -0.25 : 0),
    0,
    1,
  );
  const resourceAbundance = clamp(
    text.includes("abundant") || text.includes("rich") ? 0.75 : 0.45,
    0,
    1,
  );

  let name =
    input.name ??
    (text.includes("coast") || text.includes("harbor") || text.includes("village")
      ? base.name
      : `World ${seed.toString(16).slice(0, 4)}`);

  // Scale resource nodes by scarcity/abundance
  const resources = base.resources.map((r) => ({
    ...r,
    amount: Math.max(
      1,
      Math.round(r.amount * (0.5 + resourceAbundance) * (1.2 - foodScarcity)),
    ),
  }));

  // Optional desert / forest tint
  const terrain = base.terrain.map((row) => [...row]) as TerrainType[][];
  if (text.includes("forest")) {
    for (let i = 0; i < 8; i++) {
      const x = rng.int(2, base.settings.width);
      const y = rng.int(3, base.settings.height);
      if (terrain[y]?.[x] === "grass") terrain[y]![x] = "forest";
    }
  }
  if (text.includes("desert")) {
    for (let y = 2; y < base.settings.height; y++) {
      for (let x = 0; x < base.settings.width; x++) {
        if (terrain[y]?.[x] === "grass" && rng.next() < 0.35) {
          terrain[y]![x] = "sand";
        }
      }
    }
  }

  const characters = base.characters.map((c) => ({
    ...c,
    needs: {
      ...c.needs,
      hunger: clamp(c.needs.hunger + foodScarcity * 20, 0, 100),
    },
    inventory: {
      ...c.inventory,
      food: Math.max(
        0,
        Math.round((c.inventory.food ?? 0) * (1.1 - foodScarcity)),
      ),
    },
  }));

  const tensions = [...base.tensions];
  if (text.includes("rival")) {
    tensions.push("Heightened rivalry from the prompt");
  }
  if (text.includes("festival")) {
    tensions.push("Countdown to a public festival");
  }

  const blueprint: WorldBlueprint = {
    ...base,
    name,
    description: input.description,
    seed,
    terrain,
    resources,
    characters,
    tensions,
    settings: {
      ...base.settings,
      foodScarcity,
      resourceAbundance,
    },
  };

  return WorldBlueprintSchema.parse(blueprint);
}

export function blueprintToState(
  blueprint: WorldBlueprint,
  id: string,
): WorldState {
  return WorldStateSchema.parse({
    ...blueprint,
    id,
    tick: 0,
    feed: [
      {
        id: "feed_boot",
        tick: 0,
        text: `World "${blueprint.name}" created.`,
        severity: "info",
        characterIds: [],
      },
    ],
    metricsHistory: [],
    status: "ready",
  });
}

export function parseBlueprintJson(raw: unknown): WorldBlueprint {
  return WorldBlueprintSchema.parse(raw);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
