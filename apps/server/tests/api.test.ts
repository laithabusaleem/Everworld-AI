import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db/database.js";
import { getWorld } from "../src/db/worldStore.js";

describe("API integration", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "everworld-"));
  const dbPath = path.join(tmp, "test.sqlite");
  const config = {
    ...loadConfig({
      MODEL_PROVIDER: "rules",
      DATABASE_PATH: dbPath,
      PORT: "0",
    }),
    dbPath,
  };
  const db = openDatabase(dbPath);
  const app = createApp(config, db);
  let server: ReturnType<typeof app.listen>;
  let base = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          base = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      db.close();
    } catch {
      // ignore close races on Windows
    }
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // SQLite may briefly lock files on Windows; temp dir is disposable
    }
  });

  it("creates example world and preserves state after ticks", async () => {
    const created = await fetch(`${base}/api/worlds/example`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: 11 }),
    });
    expect(created.status).toBe(201);
    const { world } = (await created.json()) as { world: { id: string } };

    const tick = await fetch(`${base}/api/worlds/${world.id}/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 5 }),
    });
    expect(tick.status).toBe(200);
    const after = (await tick.json()) as { world: { tick: number; id: string } };
    expect(after.world.tick).toBe(5);

    const reloaded = await fetch(`${base}/api/worlds/${world.id}`);
    const body = (await reloaded.json()) as { world: { tick: number } };
    expect(body.world.tick).toBe(5);
  });

  it("fork experiment does not mutate original", async () => {
    const created = await fetch(`${base}/api/worlds/example`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: 22 }),
    });
    const { world } = (await created.json()) as {
      world: { id: string; settings: { foodScarcity: number } };
    };
    const originalScarciy = world.settings.foodScarcity;
    const before = JSON.stringify(getWorld(db, world.id));

    const exp = await fetch(`${base}/api/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceWorldId: world.id,
        variable: "foodScarcity",
        value: 0.95,
        ticks: 10,
        seed: 99,
      }),
    });
    expect(exp.status).toBe(201);
    const payload = (await exp.json()) as {
      experiment: {
        control: { metrics: unknown[] };
        treatment: { metrics: unknown[] };
      };
    };
    expect(payload.experiment.control.metrics.length).toBe(10);
    expect(payload.experiment.treatment.metrics.length).toBe(10);

    const after = getWorld(db, world.id);
    expect(JSON.stringify(after)).toBe(before);
    expect(after?.settings.foodScarcity).toBe(originalScarciy);
  });

  it("rules generate works without API key", async () => {
    const res = await fetch(`${base}/api/worlds/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "A misty forest hamlet with scarce herbs and a rival herbalist.",
        previewOnly: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; blueprint: { name: string } };
    expect(body.provider).toBe("rules");
    expect(body.blueprint.name.length).toBeGreaterThan(0);
  });
});
