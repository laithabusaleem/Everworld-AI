# Known Limitations

## Simulation

- Movement is adjacent cardinal steps only (no A* pathfinding yet).
- Map size is capped at 12×12 in the built-in generator for MVP clarity.
- Characters do not die; population metrics stay flat unless you edit state.
- Conflict metrics combine feed severity and high relationship conflict; they are indicators, not a full combat system.

## AI / models

- Default `MODEL_PROVIDER=rules` uses deterministic scoring + seeded RNG. Quality is playable but not literary.
- Optional OpenAI-compatible LLM calls are **remote and may incur cost**. Free tiers depend on the vendor.
- LLM outputs are validated; illegal actions fall back to rules. The model never executes code.
- **Reproducibility:** rule-based runs with a fixed seed are reproducible. LLM temperature and provider nondeterminism mean interactive LLM play may diverge across runs unless prompts/responses are logged and replayed (not yet implemented).

## Persistence

- SQLite file is local (`DATABASE_PATH`). Deleting the file deletes worlds.
- Reset restores the `initial` snapshot when present; worlds created before snapshots existed fall back to a soft reset.

## Performance

- Play mode runs ticks on a server interval; very fast speeds with LLM decisions will hit rate limits.
- Rendering is DOM grid cells — fine for 12×12, not optimized for huge maps.

## Security / privacy

- Designed for local single-user use. Do not expose the API to the public internet without auth.
- Do not commit `.env` or database files containing personal prompts you want private.

## Costs

| Mode | Cost |
| ---- | ---- |
| `rules` | Free (local CPU only) |
| `openai` | Per-token charges from your provider; world generation and per-character decisions can add up |
