/** Embedded migrations so runtime does not depend on copying .sql files. */
export const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  seed INTEGER NOT NULL,
  status TEXT NOT NULL,
  parent_world_id TEXT,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_snapshots (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  label TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_world_id TEXT NOT NULL,
  variable TEXT NOT NULL,
  value_json TEXT NOT NULL,
  ticks INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_world_id) REFERENCES worlds(id) ON DELETE CASCADE
);
`,
  },
];
