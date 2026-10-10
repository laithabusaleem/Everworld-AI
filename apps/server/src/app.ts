import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import {
  blueprintToState,
  createCoastalVillageBlueprint,
  forkWorld,
  generateWorldRules,
  runExperiment,
  SimulationEngine,
  WorldBlueprintSchema,
  WorldStateSchema,
  type ExperimentVariable,
  type WorldState,
} from "@everworld/engine";
import type { AppConfig } from "./config.js";
import { llmConfigured } from "./config.js";
import type { Db } from "./db/database.js";
import {
  deleteWorld,
  getExperiment,
  getInitialSnapshot,
  getWorld,
  listExperiments,
  listWorlds,
  saveExperiment,
  saveSnapshot,
  saveWorld,
} from "./db/worldStore.js";
import { createModelFacade } from "./llm/provider.js";
import { logger } from "./logger.js";

type Runtime = {
  engine: SimulationEngine;
  playing: boolean;
  timer?: ReturnType<typeof setInterval>;
  tickMs: number;
};

export function createApp(config: AppConfig, db: Db) {
  const app = express();
  const models = createModelFacade(config);
  const runtimes = new Map<string, Runtime>();

  app.use(
    cors({
      origin: config.corsOrigin,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      provider: models.mode,
      llmConfigured: llmConfigured(config),
    });
  });

  app.get("/api/meta", (_req, res) => {
    res.json({
      name: "Everworld AI",
      version: "0.1.0",
      provider: models.mode,
      llmConfigured: llmConfigured(config),
      demoMode: !llmConfigured(config),
    });
  });

  app.get("/api/worlds", (_req, res) => {
    res.json({ worlds: listWorlds(db) });
  });

  app.get("/api/worlds/:id", (req, res) => {
    const world = getWorld(db, req.params.id);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    res.json({ world });
  });

  app.delete("/api/worlds/:id", (req, res) => {
    stopRuntime(runtimes, req.params.id);
    const ok = deleteWorld(db, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    res.json({ ok: true });
  });

  app.post("/api/worlds/example", (req, res) => {
    const seed = Number(req.body?.seed ?? 42);
    const blueprint = createCoastalVillageBlueprint(seed);
    const id = `world_${randomUUID().slice(0, 8)}`;
    const state = blueprintToState(blueprint, id);
    saveWorld(db, state);
    saveSnapshot(db, id, "initial", state);
    res.status(201).json({ world: state });
  });

  app.post("/api/worlds/generate", async (req, res) => {
    try {
      const description = String(req.body?.description ?? "").trim();
      if (description.length < 8 || description.length > 4000) {
        res.status(400).json({ error: "description must be 8–4000 characters" });
        return;
      }
      const seed =
        req.body?.seed !== undefined ? Number(req.body.seed) : undefined;
      const name = req.body?.name ? String(req.body.name) : undefined;
      const previewOnly = Boolean(req.body?.previewOnly);

      const blueprint = await models.generateWorld({
        description,
        seed,
        name,
      });
      const validated = WorldBlueprintSchema.parse(blueprint);

      if (previewOnly) {
        res.json({ blueprint: validated, provider: models.mode });
        return;
      }

      const id = `world_${randomUUID().slice(0, 8)}`;
      const state = blueprintToState(validated, id);
      saveWorld(db, state);
      saveSnapshot(db, id, "initial", state);
      res.status(201).json({ world: state, provider: models.mode });
    } catch (err) {
      logger.error("generate failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "World generation failed" });
    }
  });

  app.post("/api/worlds/from-blueprint", (req, res) => {
    try {
      const blueprint = WorldBlueprintSchema.parse(req.body?.blueprint);
      const id = `world_${randomUUID().slice(0, 8)}`;
      const state = blueprintToState(blueprint, id);
      saveWorld(db, state);
      saveSnapshot(db, id, "initial", state);
      res.status(201).json({ world: state });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Invalid blueprint",
      });
    }
  });

  app.patch("/api/worlds/:id", (req, res) => {
    const world = getWorld(db, req.params.id);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    const next = WorldStateSchema.parse({
      ...world,
      ...req.body,
      id: world.id,
    });
    saveWorld(db, next);
    const rt = runtimes.get(world.id);
    if (rt) rt.engine.setState(next);
    res.json({ world: next });
  });

  app.post("/api/worlds/:id/tick", async (req, res) => {
    try {
      const count = Math.min(50, Math.max(1, Number(req.body?.count ?? 1)));
      const runtime = ensureRuntime(runtimes, db, models, req.params.id);
      if (!runtime) {
        res.status(404).json({ error: "World not found" });
        return;
      }
      for (let i = 0; i < count; i++) {
        await runtime.engine.tick();
      }
      const world = runtime.engine.getState();
      world.status = "paused";
      saveWorld(db, world);
      res.json({ world });
    } catch (err) {
      logger.error("tick failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Tick failed" });
    }
  });

  app.post("/api/worlds/:id/play", (req, res) => {
    const runtime = ensureRuntime(runtimes, db, models, req.params.id);
    if (!runtime) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    runtime.tickMs = Math.max(
      100,
      Math.min(5000, Number(req.body?.tickMs ?? runtime.tickMs)),
    );
    if (runtime.timer) clearInterval(runtime.timer);
    runtime.playing = true;
    runtime.timer = setInterval(() => {
      void (async () => {
        try {
          await runtime.engine.tick();
          const world = runtime.engine.getState();
          world.status = "running";
          saveWorld(db, world);
        } catch (err) {
          logger.error("play tick failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          stopRuntime(runtimes, req.params.id);
        }
      })();
    }, runtime.tickMs);
    res.json({ ok: true, tickMs: runtime.tickMs });
  });

  app.post("/api/worlds/:id/pause", (req, res) => {
    const runtime = runtimes.get(req.params.id);
    if (runtime) {
      runtime.playing = false;
      if (runtime.timer) clearInterval(runtime.timer);
      runtime.timer = undefined;
      const world = runtime.engine.getState();
      world.status = "paused";
      saveWorld(db, world);
      res.json({ world });
      return;
    }
    const world = getWorld(db, req.params.id);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    world.status = "paused";
    saveWorld(db, world);
    res.json({ world });
  });

  app.post("/api/worlds/:id/reset", (req, res) => {
    stopRuntime(runtimes, req.params.id);
    const current = getWorld(db, req.params.id);
    if (!current) {
      res.status(404).json({ error: "World not found" });
      return;
    }

    if (req.body?.state) {
      const provided = WorldStateSchema.parse(req.body.state);
      saveWorld(db, provided);
      res.json({ world: provided });
      return;
    }

    const initial = getInitialSnapshot(db, req.params.id);
    if (initial) {
      const restored = WorldStateSchema.parse({
        ...initial,
        id: current.id,
        status: "ready",
        feed: [
          {
            id: "feed_reset",
            tick: 0,
            text: "World restored from initial snapshot.",
            severity: "info",
            characterIds: [],
          },
        ],
      });
      saveWorld(db, restored);
      res.json({ world: restored });
      return;
    }

    const reset = WorldStateSchema.parse({
      ...current,
      tick: 0,
      feed: [
        {
          id: "feed_reset",
          tick: 0,
          text: "World reset (no initial snapshot available).",
          severity: "info",
          characterIds: [],
        },
      ],
      metricsHistory: [],
      status: "ready",
      events: current.events.map((e) => ({ ...e, processed: false })),
      characters: current.characters.map((c) => ({
        ...c,
        lastDecision: undefined,
      })),
    });
    saveWorld(db, reset);
    res.json({ world: reset });
  });

  app.post("/api/worlds/:id/snapshot", (req, res) => {
    const world = getWorld(db, req.params.id);
    if (!world) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    const label = String(req.body?.label ?? "manual");
    const snapId = saveSnapshot(db, world.id, label, world);
    res.status(201).json({ snapshotId: snapId });
  });

  app.post("/api/experiments", async (req, res) => {
    try {
      const sourceWorldId = String(req.body?.sourceWorldId ?? "");
      const source = getWorld(db, sourceWorldId);
      if (!source) {
        res.status(404).json({ error: "Source world not found" });
        return;
      }
      // Prefer the immutable initial snapshot so forks share equivalent starts
      const snapshot = getInitialSnapshot(db, sourceWorldId);
      const initial = structuredClone(snapshot ?? source) as WorldState;
      initial.tick = 0;
      initial.metricsHistory = [];
      initial.feed = [];
      initial.status = "ready";
      initial.events = initial.events.map((e) => ({ ...e, processed: false }));
      initial.characters = initial.characters.map((c) => ({
        ...c,
        lastDecision: undefined,
      }));

      const variable = String(req.body?.variable ?? "foodScarcity") as ExperimentVariable;
      const value = req.body?.value;
      const ticks = Math.min(200, Math.max(5, Number(req.body?.ticks ?? 40)));
      const seed = Number(req.body?.seed ?? source.seed);
      const id = `exp_${randomUUID().slice(0, 8)}`;
      const name = String(req.body?.name ?? `Experiment ${id}`);

      // Ensure original untouched
      const originalJson = JSON.stringify(source);

      const result = await runExperiment(initial, {
        id,
        name,
        variable,
        value,
        ticks,
        seed,
      });

      if (JSON.stringify(getWorld(db, sourceWorldId)) !== originalJson) {
        logger.error("Experiment mutated source world unexpectedly");
      }

      // Persist forked branch worlds for inspection (optional)
      saveWorld(db, result.control.finalState);
      saveWorld(db, result.treatment.finalState);

      const payload = {
        id,
        name,
        sourceWorldId,
        variable,
        value,
        ticks,
        seed,
        notes: result.notes,
        control: {
          worldId: result.control.worldId,
          label: result.control.label,
          metrics: result.control.metrics,
          finalTick: result.control.finalState.tick,
        },
        treatment: {
          worldId: result.treatment.worldId,
          label: result.treatment.label,
          metrics: result.treatment.metrics,
          finalTick: result.treatment.finalState.tick,
        },
      };

      saveExperiment(db, {
        id,
        name,
        sourceWorldId,
        variable,
        value,
        ticks,
        seed,
        result: payload,
      });

      res.status(201).json({ experiment: payload });
    } catch (err) {
      logger.error("experiment failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: "Experiment failed" });
    }
  });

  app.get("/api/experiments", (_req, res) => {
    res.json({ experiments: listExperiments(db) });
  });

  app.get("/api/experiments/:id", (req, res) => {
    const experiment = getExperiment(db, req.params.id);
    if (!experiment) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }
    res.json({ experiment });
  });

  app.post("/api/worlds/:id/fork", (req, res) => {
    const source = getWorld(db, req.params.id);
    if (!source) {
      res.status(404).json({ error: "World not found" });
      return;
    }
    const before = JSON.stringify(source);
    const id = `world_${randomUUID().slice(0, 8)}`;
    const forked = forkWorld(source, id, {
      settings: req.body?.settings,
      socialRulePatch: req.body?.socialRulePatch,
      experimentVariable: req.body?.experimentVariable,
    });
    saveWorld(db, forked);
    const after = getWorld(db, source.id);
    if (JSON.stringify(after) !== before) {
      res.status(500).json({ error: "Fork mutated source" });
      return;
    }
    res.status(201).json({ world: forked });
  });

  // Demo helper: rules-only generate for tests
  app.post("/api/demo/generate-rules", (req, res) => {
    const description = String(req.body?.description ?? "A quiet forest hamlet");
    const blueprint = generateWorldRules({ description, seed: 1 });
    res.json({ blueprint });
  });

  return app;
}

function ensureRuntime(
  runtimes: Map<string, Runtime>,
  db: Db,
  models: ReturnType<typeof createModelFacade>,
  worldId: string,
): Runtime | null {
  const existing = runtimes.get(worldId);
  if (existing) {
    const fresh = getWorld(db, worldId);
    if (fresh) existing.engine.setState(fresh);
    return existing;
  }
  const world = getWorld(db, worldId);
  if (!world) return null;
  const runtime: Runtime = {
    engine: new SimulationEngine(world, {
      decisionProvider: models.createDecisionProvider(),
    }),
    playing: false,
    tickMs: 700,
  };
  runtimes.set(worldId, runtime);
  return runtime;
}

function stopRuntime(runtimes: Map<string, Runtime>, worldId: string) {
  const rt = runtimes.get(worldId);
  if (!rt) return;
  if (rt.timer) clearInterval(rt.timer);
  runtimes.delete(worldId);
}
