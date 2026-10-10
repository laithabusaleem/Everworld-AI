import type { TerrainType, WorldBlueprint } from "../schemas.js";

function grid(w: number, h: number, fill: TerrainType): TerrainType[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

/** Built-in example: coastal village with rival merchants and a festival. */
export function createCoastalVillageBlueprint(seed = 42): WorldBlueprint {
  const width = 12;
  const height = 12;
  const terrain = grid(width, height, "grass");

  for (let x = 0; x < width; x++) {
    terrain[0]![x] = "water";
    terrain[1]![x] = x % 3 === 0 ? "water" : "sand";
  }
  for (let y = 2; y < height; y++) {
    terrain[y]![0] = "sand";
    terrain[y]![1] = y % 2 === 0 ? "path" : "sand";
  }
  for (let x = 2; x < 10; x++) {
    terrain[5]![x] = "path";
    terrain[8]![x] = "path";
  }
  terrain[3]![9] = "rock";
  terrain[3]![10] = "building";
  terrain[4]![10] = "building";
  terrain[6]![3] = "building";
  terrain[6]![8] = "building";
  terrain[9]![4] = "forest";
  terrain[9]![5] = "forest";
  terrain[10]![5] = "forest";

  return {
    name: "Harbor of Twin Sails",
    description:
      "A coastal village with scarce food, two rival merchant families, an abandoned lighthouse, and a festival in three days.",
    seed,
    settings: {
      width,
      height,
      foodScarcity: 0.55,
      resourceAbundance: 0.35,
      tickHungerDrain: 1.5,
      memoryCap: 16,
      maxActionsPerCharacterPerTick: 1,
      socialRules: [
        {
          id: "harbor_custom",
          name: "Harbor Custom",
          description: "Trade encouraged; cells not shared.",
          requireTrustForTrade: false,
          allowCellSharing: false,
          allowResourceDebt: false,
        },
      ],
    },
    terrain,
    locations: [
      {
        id: "loc_docks",
        name: "Docks",
        x: 2,
        y: 2,
        description: "Weathered piers where fish are landed.",
        tags: ["work", "food"],
      },
      {
        id: "loc_market",
        name: "Market Square",
        x: 5,
        y: 5,
        description: "Stalls and arguments under faded awnings.",
        tags: ["market", "work", "social"],
      },
      {
        id: "loc_lighthouse",
        name: "Abandoned Lighthouse",
        x: 10,
        y: 3,
        description: "A cracked tower overlooking the bay.",
        tags: ["mystery"],
      },
      {
        id: "loc_marina_house",
        name: "Marina Family House",
        x: 3,
        y: 6,
        description: "Home of the Marina merchant clan.",
        tags: ["home"],
      },
      {
        id: "loc_corvin_house",
        name: "Corvin Family House",
        x: 8,
        y: 6,
        description: "Home of the Corvin merchant clan.",
        tags: ["home"],
      },
      {
        id: "loc_grove",
        name: "Forager's Grove",
        x: 5,
        y: 9,
        description: "Thin woods with edible roots.",
        tags: ["food"],
      },
    ],
    characters: [
      {
        id: "char_elena",
        name: "Elena Marina",
        role: "Merchant matriarch",
        traits: ["proud", "strategic", "protective"],
        skills: { trade: 80, negotiation: 75, sailing: 40 },
        goals: ["Secure food for the festival", "Outshine the Corvins"],
        x: 3,
        y: 6,
        inventory: { food: 2, coin: 12 },
        needs: { hunger: 35, energy: 80, social: 40, safety: 60 },
        memories: [
          {
            id: "mem_e1",
            tick: 0,
            kind: "semantic",
            text: "The Marinas have traded salt fish for generations.",
            importance: 0.7,
            subjects: ["family"],
            private: false,
          },
        ],
        relationships: [
          {
            targetId: "char_luca",
            trust: -20,
            familiarity: 70,
            conflict: 55,
            alliance: false,
            notes: "Rival merchant family",
          },
          {
            targetId: "char_mira",
            trust: 60,
            familiarity: 80,
            conflict: 5,
            alliance: true,
            notes: "Loyal forager",
          },
        ],
        knownFacts: ["festival_soon"],
      },
      {
        id: "char_luca",
        name: "Luca Corvin",
        role: "Merchant rival",
        traits: ["charming", "ambitious", "impatient"],
        skills: { trade: 78, persuasion: 70, gambling: 50 },
        goals: ["Control the market stalls", "Weaken Marina influence"],
        x: 8,
        y: 6,
        inventory: { food: 1, coin: 15 },
        needs: { hunger: 40, energy: 75, social: 50, safety: 55 },
        memories: [
          {
            id: "mem_l1",
            tick: 0,
            kind: "semantic",
            text: "Corvins prefer flashy deals over slow stockpiling.",
            importance: 0.6,
            subjects: ["family"],
            private: false,
          },
        ],
        relationships: [
          {
            targetId: "char_elena",
            trust: -25,
            familiarity: 70,
            conflict: 60,
            alliance: false,
            notes: "Bitter rivalry",
          },
          {
            targetId: "char_theo",
            trust: 50,
            familiarity: 65,
            conflict: 10,
            alliance: true,
            notes: "Dock worker ally",
          },
        ],
        knownFacts: ["festival_soon"],
      },
      {
        id: "char_mira",
        name: "Mira Quill",
        role: "Forager",
        traits: ["quiet", "observant", "kind"],
        skills: { foraging: 85, cooking: 60 },
        goals: ["Find enough roots for the village", "Avoid family feuds"],
        x: 5,
        y: 9,
        inventory: { food: 3, coin: 2 },
        needs: { hunger: 25, energy: 70, social: 55, safety: 50 },
        memories: [],
        relationships: [
          {
            targetId: "char_elena",
            trust: 55,
            familiarity: 60,
            conflict: 0,
            alliance: true,
            notes: "Sells forage to Marinas",
          },
        ],
        knownFacts: ["grove_has_roots"],
      },
      {
        id: "char_theo",
        name: "Theo Brine",
        role: "Dock worker",
        traits: ["sturdy", "blunt", "loyal"],
        skills: { labor: 80, fishing: 65 },
        goals: ["Keep the docks working", "Earn coin before the festival"],
        x: 2,
        y: 2,
        inventory: { food: 1, coin: 4 },
        needs: { hunger: 45, energy: 65, social: 35, safety: 50 },
        memories: [
          {
            id: "mem_t1",
            tick: 0,
            kind: "episodic",
            text: "Saw a light flicker in the abandoned lighthouse last week.",
            importance: 0.8,
            subjects: ["loc_lighthouse"],
            private: true,
          },
        ],
        relationships: [
          {
            targetId: "char_luca",
            trust: 45,
            familiarity: 50,
            conflict: 5,
            alliance: false,
            notes: "Occasional employer",
          },
        ],
        knownFacts: ["private:lighthouse_flicker"],
      },
      {
        id: "char_sera",
        name: "Sera Lampwick",
        role: "Festival planner",
        traits: ["organized", "anxious", "diplomatic"],
        skills: { planning: 75, diplomacy: 70 },
        goals: ["Make the festival succeed", "Ease merchant tensions"],
        x: 5,
        y: 5,
        inventory: { food: 2, coin: 8 },
        needs: { hunger: 30, energy: 70, social: 20, safety: 65 },
        memories: [],
        relationships: [
          {
            targetId: "char_elena",
            trust: 30,
            familiarity: 40,
            conflict: 15,
            alliance: false,
            notes: "Needs Marina sponsorship",
          },
          {
            targetId: "char_luca",
            trust: 30,
            familiarity: 40,
            conflict: 15,
            alliance: false,
            notes: "Needs Corvin sponsorship",
          },
        ],
        knownFacts: ["festival_soon"],
      },
    ],
    resources: [
      {
        id: "res_fish",
        kind: "food",
        amount: 6,
        x: 2,
        y: 2,
        renewable: true,
      },
      {
        id: "res_roots",
        kind: "food",
        amount: 5,
        x: 5,
        y: 9,
        renewable: true,
      },
      {
        id: "res_crates",
        kind: "goods",
        amount: 4,
        x: 5,
        y: 5,
        renewable: false,
      },
    ],
    events: [
      {
        id: "evt_festival",
        tick: 30,
        title: "Festival Preparations Peak",
        description:
          "Banners go up in the market; families are judged by how much food they contribute.",
        severity: "tension",
        locationId: "loc_market",
        characterIds: ["char_elena", "char_luca", "char_sera"],
        public: true,
        processed: false,
      },
      {
        id: "evt_lighthouse",
        tick: 15,
        title: "Strange Light at the Lighthouse",
        description:
          "A pale lantern glow is reported from the abandoned lighthouse.",
        severity: "info",
        locationId: "loc_lighthouse",
        characterIds: ["char_theo"],
        public: false,
        processed: false,
      },
    ],
    tensions: [
      "Marina vs Corvin rivalry over market stalls",
      "Food scarcity before the festival",
      "Mystery at the abandoned lighthouse",
    ],
  };
}
