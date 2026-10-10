# Everworld AI — Test Plan

## Unit tests (`packages/engine`)

| Test | Expectation |
| ---- | ----------- |
| `coastalVillage` fixture validates | Zod parse succeeds |
| Movement off-map rejected | ActionValidator fails |
| Negative food without debt rule rejected | Resource invariant |
| Duplicate memory suppressed | MemoryStore dedupe |
| 100 ticks produce only valid applied actions | No throw; invariants hold |
| Fork then mutate leaves original unchanged | Deep equality on original |
| Metrics collected each tick | Length === tick count |

## Integration tests (`apps/server`)

| Test | Expectation |
| ---- | ----------- |
| Create world from example | 201 + id |
| Save after ticks, reload | State tick matches |
| Fork experiment | Parent state unchanged |
| Rules provider generate | Blueprint without API key |

## Manual QA checklist

1. Open home → load example → play → pause → step → inspect character
2. Create from description in demo mode → preview → edit name → create
3. Run experiment: fork, raise food scarcity, compare charts
4. With optional API key: generate world via LLM (documented if unverified)

## CI

GitHub Actions: `npm ci`, `npm test`, `npm run typecheck`, `npm run build` on Node 22/24.
