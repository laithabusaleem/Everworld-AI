import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  assertInvariants,
  blueprintToState,
  createCoastalVillageBlueprint,
  createRng,
  forkWorld,
  generateWorldRules,
  RuleBasedDecisionProvider,
  runExperiment,
  SimulationEngine,
  validateAction,
  WorldBlueprintSchema,
} from "../src/index.js";

describe("world fixtures", () => {
  it("validates coastal village blueprint", () => {
    const bp = createCoastalVillageBlueprint(42);
    expect(() => WorldBlueprintSchema.parse(bp)).not.toThrow();
    expect(bp.characters.length).toBeGreaterThanOrEqual(4);
  });

  it("generates a world from description without API", () => {
    const bp = generateWorldRules({
      description:
        "A coastal village with scarce food, two rival merchant families, an abandoned lighthouse, and a festival in three days.",
      seed: 7,
    });
    expect(bp.settings.foodScarcity).toBeGreaterThan(0.5);
    expect(bp.seed).toBe(7);
  });
});

describe("invariants", () => {
  it("rejects movement off map", () => {
    const state = blueprintToState(createCoastalVillageBlueprint(), "w1");
    const actor = state.characters[0]!;
    const result = validateAction(state, {
      type: "move",
      actorId: actor.id,
      dx: -1,
      dy: 0,
    });
    // May be illegal depending on position; force corner
    const cornerState = {
      ...state,
      characters: state.characters.map((c, i) =>
        i === 0 ? { ...c, x: 0, y: 0 } : c,
      ),
    };
    const bad = validateAction(cornerState, {
      type: "move",
      actorId: actor.id,
      dx: -1,
      dy: 0,
    });
    expect(bad.ok).toBe(false);
  });

  it("rejects eat without food", () => {
    const state = blueprintToState(createCoastalVillageBlueprint(), "w1");
    const actor = {
      ...state.characters[0]!,
      inventory: { food: 0, coin: 0 },
    };
    const next = {
      ...state,
      characters: [actor, ...state.characters.slice(1)],
    };
    const result = validateAction(next, {
      type: "eat",
      actorId: actor.id,
      resourceKind: "food",
      amount: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("parses actions with zod", () => {
    expect(() =>
      ActionSchema.parse({ type: "wait", actorId: "char_elena" }),
    ).not.toThrow();
  });
});

describe("simulation", () => {
  it("runs 100 ticks with valid actions and invariants", async () => {
    const state = blueprintToState(createCoastalVillageBlueprint(99), "sim100");
    const engine = new SimulationEngine(state, {
      decisionProvider: new RuleBasedDecisionProvider(),
      rng: createRng(99),
    });
    await engine.run(100);
    const final = engine.getState();
    expect(final.tick).toBe(100);
    expect(final.metricsHistory.length).toBe(100);
    expect(() => assertInvariants(final)).not.toThrow();
    for (const c of final.characters) {
      expect(c.lastDecision).toBeDefined();
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("experimental worlds", () => {
  it("fork does not mutate the original world", () => {
    const original = blueprintToState(createCoastalVillageBlueprint(1), "orig");
    const snapshot = JSON.stringify(original);
    const forked = forkWorld(original, "fork1", {
      settings: { foodScarcity: 0.9 },
      experimentVariable: "foodScarcity=0.9",
    });
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(forked.id).toBe("fork1");
    expect(forked.settings.foodScarcity).toBe(0.9);
    expect(original.settings.foodScarcity).not.toBe(0.9);
    expect(forked.parentWorldId).toBe("orig");
  });

  it("comparison uses actual simulation metrics", async () => {
    const initial = blueprintToState(createCoastalVillageBlueprint(5), "base");
    // Capture initial snapshot at tick 0
    const result = await runExperiment(initial, {
      id: "exp1",
      name: "Scarcity test",
      variable: "foodScarcity",
      value: 0.9,
      ticks: 20,
      seed: 1234,
    });
    expect(result.control.metrics.length).toBe(20);
    expect(result.treatment.metrics.length).toBe(20);
    expect(result.treatment.finalState.settings.foodScarcity).toBe(0.9);
    expect(result.control.finalState.settings.foodScarcity).toBe(
      initial.settings.foodScarcity,
    );
    // Metrics should reflect real ticks
    expect(result.control.metrics[0]?.tick).toBe(1);
    expect(result.control.metrics[19]?.population).toBeGreaterThan(0);
  });
});
