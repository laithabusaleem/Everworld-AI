# Everworld AI — Implementation Plan

## Defaults chosen (no blocker)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Monorepo | npm workspaces | Simple for Windows + Node 24 |
| UI | Vite + React + TypeScript | Fast DX, portfolio-friendly |
| Server | Express + `node:sqlite` | No native compile on Windows |
| Validation | Zod | Structured AI outputs |
| License | MIT | Portfolio OSS default |
| Map size | 12×12 MVP | Enough for society, easy to render |
| Demo AI | Keyword + rule scoring | Works offline |

## Prioritized tasks

### P0 — Core path

1. Engine schemas + world example (coastal village)
2. Tick loop, actions, invariants
3. Rule-based generation + decisions
4. SQLite persistence + REST API
5. Basic web UI wired to API
6. Automated 100-tick test

### P1 — Product polish

7. Preview/edit before create
8. Character inspector + decision explanation
9. Memory summarization + relationship updates
10. Experimental worlds fork + comparison charts
11. LLM provider behind env flags

### P2 — Release

12. Docs, CI, README experiment, screenshots notes
13. CONTRIBUTING, CHANGELOG, KNOWN_LIMITATIONS

## Acceptance mapping

| Criterion | Verification |
| --------- | ------------ |
| Generate or load example world | API + UI + example fixture |
| 100 ticks valid actions | `packages/engine` vitest |
| Resource/movement invariants | unit tests |
| Save/reopen preserves state | server integration test |
| Fork does not mutate original | engine + API test |
| Comparison uses real metrics | experiment runner stores ticks |
| Works without paid API | `MODEL_PROVIDER=rules` default |

## Remaining after MVP (roadmap)

- Pathfinding beyond adjacent moves
- Dialogue UI between characters
- Record/replay LLM action logs for strict reproducibility
- Larger maps and performance profiling
- Export world as JSON pack
