# Everworld AI — Architecture

```
┌─────────────┐     HTTP/JSON      ┌──────────────────┐
│  Web (React)│ ◄────────────────► │  Server (Express)│
│  rendering  │                    │  API + LLM proxy │
└─────────────┘                    └────────┬─────────┘
                                            │
                       ┌────────────────────┼────────────────────┐
                       ▼                    ▼                    ▼
              ┌────────────────┐   ┌────────────────┐   ┌──────────────┐
              │ @everworld/    │   │ SQLite (node:  │   │ ModelProvider│
              │ engine         │   │ sqlite)        │   │ (rules/LLM)  │
              │ pure TS sim    │   │ migrations     │   └──────────────┘
              └────────────────┘   └────────────────┘
```

## Layers

1. **UI** (`apps/web`) — map, inspector, feed, timeline, experiments. No secrets. Talks only to the local API.
2. **API** (`apps/server`) — REST endpoints, persistence, LLM proxy, config. Holds API keys in env.
3. **Engine** (`packages/engine`) — framework-independent TypeScript. World state, tick loop, validation, forks, metrics. No React, no HTTP, no DB.
4. **Providers** — `RuleBasedProvider` (default) and `OpenAICompatibleProvider` for generation and decisions.
5. **Storage** — SQLite via Node.js `node:sqlite`, schema migrations in `apps/server/src/db/migrations`.

## Engine design

- **WorldState** is the single source of truth for a running simulation.
- **SimulationEngine.tick()** processes: scheduled events → character decisions → action validation → application → memory updates → metrics snapshot.
- **ActionValidator** enforces movement adjacency, resource non-negativity (unless rule allows debt), collision (one character per cell unless sharing allowed), and knowledge limits for speech/trade targets.
- **MemoryStore** keeps recent episodic memories; when over cap, older ones are summarized into a single semantic memory.
- **Rng** is seedable (`mulberry32`) for deterministic rule-based runs.

## Model output trust boundary

LLM responses are parsed into a proposed action schema. Invalid or illegal proposals are discarded. The engine never executes free-form code from the model.

## Persistence

| Table | Purpose |
| ----- | ------- |
| `worlds` | Metadata + current serialized state JSON |
| `world_snapshots` | Named snapshots for forks / reset |
| `experiments` | Fork pairs, variable, seed, settings |
| `experiment_metrics` | Per-tick metric rows for comparison |

Migration strategy: numbered SQL files applied in order; `schema_migrations` table records applied versions.

## Configuration

Server reads `.env` (see `.env.example`). Client receives only non-secret capability flags (`demoMode`, `llmConfigured`).

## Rendering vs simulation

The engine advances state; the web app polls or receives state snapshots. Tick speed is a UI/server scheduling concern, not embedded in rendering.
