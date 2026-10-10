# Examples

## Coastal village (built-in)

The engine embeds `createCoastalVillageBlueprint()` used by:

- Home page → **Load coastal village example**
- `POST /api/worlds/example`

Prompt used in docs and UI:

> A coastal village with scarce food, two rival merchant families, an abandoned lighthouse, and a festival in three days.

## Suggested experiment

| Field | Value |
| ----- | ----- |
| Variable | `foodScarcity` |
| Treatment | `0.9` |
| Ticks | `40` |
| Seed | `42` |

Compare total food and average hunger between control and treatment.
