# Contributing

Thanks for interest in Everworld AI.

## Development setup (PowerShell)

```powershell
Copy-Item .env.example .env
npm install
npm run build -w @everworld/engine
npm run dev
```

## Checks before a PR

```powershell
npm test
npm run typecheck
npm run build
```

## Guidelines

- Keep `packages/engine` free of React, Express, and filesystem I/O.
- Treat LLM output as untrusted; validate against schemas and legal actions.
- Never commit `.env`, API keys, or local SQLite databases.
- Prefer small, focused PRs with tests for engine invariants.

## Reporting issues

Include Node version, OS, whether `MODEL_PROVIDER` is `rules` or `openai`, and steps to reproduce.
