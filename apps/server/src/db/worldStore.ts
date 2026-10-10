import type { WorldState } from "@everworld/engine";
import { WorldStateSchema } from "@everworld/engine";
import type { Db } from "./database.js";

export type WorldRow = {
  id: string;
  name: string;
  description: string;
  seed: number;
  status: string;
  parentWorldId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function saveWorld(db: Db, state: WorldState): void {
  const parsed = WorldStateSchema.parse(state);
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT id FROM worlds WHERE id = ?")
    .get(parsed.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE worlds SET name = ?, description = ?, seed = ?, status = ?,
       parent_world_id = ?, state_json = ?, updated_at = ? WHERE id = ?`,
    ).run(
      parsed.name,
      parsed.description,
      parsed.seed,
      parsed.status,
      parsed.parentWorldId ?? null,
      JSON.stringify(parsed),
      now,
      parsed.id,
    );
  } else {
    db.prepare(
      `INSERT INTO worlds (id, name, description, seed, status, parent_world_id, state_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      parsed.id,
      parsed.name,
      parsed.description,
      parsed.seed,
      parsed.status,
      parsed.parentWorldId ?? null,
      JSON.stringify(parsed),
      now,
      now,
    );
  }
}

export function getWorld(db: Db, id: string): WorldState | null {
  const row = db
    .prepare("SELECT state_json FROM worlds WHERE id = ?")
    .get(id) as { state_json: string } | undefined;
  if (!row) return null;
  return WorldStateSchema.parse(JSON.parse(row.state_json));
}

export function listWorlds(db: Db): WorldRow[] {
  const rows = db
    .prepare(
      `SELECT id, name, description, seed, status, parent_world_id, created_at, updated_at
       FROM worlds ORDER BY updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    name: string;
    description: string;
    seed: number;
    status: string;
    parent_world_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    seed: r.seed,
    status: r.status,
    parentWorldId: r.parent_world_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function deleteWorld(db: Db, id: string): boolean {
  const result = db.prepare("DELETE FROM worlds WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

export function saveSnapshot(
  db: Db,
  worldId: string,
  label: string,
  state: WorldState,
): string {
  const id = `snap_${worldId}_${Date.now()}`;
  db.prepare(
    `INSERT INTO world_snapshots (id, world_id, label, state_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, worldId, label, JSON.stringify(state), new Date().toISOString());
  return id;
}

export function getLatestSnapshot(db: Db, worldId: string): WorldState | null {
  const row = db
    .prepare(
      `SELECT state_json FROM world_snapshots WHERE world_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(worldId) as { state_json: string } | undefined;
  if (!row) return null;
  return WorldStateSchema.parse(JSON.parse(row.state_json));
}

export function getInitialSnapshot(db: Db, worldId: string): WorldState | null {
  const row = db
    .prepare(
      `SELECT state_json FROM world_snapshots
       WHERE world_id = ? AND label = 'initial'
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(worldId) as { state_json: string } | undefined;
  if (!row) return null;
  return WorldStateSchema.parse(JSON.parse(row.state_json));
}

export function saveExperiment(
  db: Db,
  experiment: {
    id: string;
    name: string;
    sourceWorldId: string;
    variable: string;
    value: unknown;
    ticks: number;
    seed: number;
    result: unknown;
  },
): void {
  db.prepare(
    `INSERT INTO experiments (id, name, source_world_id, variable, value_json, ticks, seed, result_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    experiment.id,
    experiment.name,
    experiment.sourceWorldId,
    experiment.variable,
    JSON.stringify(experiment.value),
    experiment.ticks,
    experiment.seed,
    JSON.stringify(experiment.result),
    new Date().toISOString(),
  );
}

export function getExperiment(db: Db, id: string): unknown | null {
  const row = db
    .prepare("SELECT result_json FROM experiments WHERE id = ?")
    .get(id) as { result_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.result_json);
}

export function listExperiments(db: Db) {
  return db
    .prepare(
      `SELECT id, name, source_world_id, variable, ticks, seed, created_at
       FROM experiments ORDER BY created_at DESC`,
    )
    .all();
}
