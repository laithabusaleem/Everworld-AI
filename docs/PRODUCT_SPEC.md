# Everworld AI — Product Specification

## Problem

Sandbox world simulators and narrative AI tools either require complex setup, paid APIs for every interaction, or hide agent reasoning. Students and indie builders need a transparent, inspectable society simulator they can run locally, fork experimentally, and show in a portfolio.

## Intended users

- Students exploring multi-agent systems and emergent narrative
- Indie game / interactive fiction creators prototyping societies
- Portfolio reviewers evaluating systems design and AI integration

## Product summary

**Everworld AI** is a browser-based sandbox. The user describes a fictional world; the app creates a small persistent society of autonomous characters on a grid map. Characters observe locally, recall memories, act under resource and movement rules, and form relationships. A unique **Experimental Worlds** feature forks a saved world, changes one variable, and compares outcomes.

## Inspiration note

Product inspiration was drawn from the public README of [WorldX](https://github.com/YGYOOO/WorldX) (MIT). Everworld AI does **not** copy WorldX assets, branding, prompts, or implementation. Differentiation: rule-based demo mode without API keys, framework-independent engine, and scenario comparison (fork → mutate → metric timelines).

## Core workflows

### 1. Create a world

1. User enters a free-text description (or loads the coastal village example).
2. System produces validated JSON (terrain, locations, characters, resources, events).
3. User previews and may edit fields before commit.
4. World is persisted and opened in the simulator.

### 2. Simulate

1. Discrete ticks advance a simulation clock.
2. Each character: observe → retrieve memories → propose action → validate → apply.
3. UI shows map, event feed, inspector, relationships, pause / resume / step / reset.
4. Decision explanations are stored per character for the latest action.

### 3. Experimental worlds (unique enhancement)

1. User forks a saved world from an equivalent initial snapshot.
2. User modifies one experimental variable (e.g. food scarcity, social rule).
3. Both branches run for N ticks (same seed where deterministic).
4. Comparison view charts population-related metrics, resources, alliances, conflicts.
5. UI discloses that LLM stochasticity may break exact reproducibility unless outputs are recorded.

## Feature list (MVP)

| Feature | Status target |
| ------- | ------------- |
| Rule-based world generation from description | MVP |
| Optional LLM world generation (OpenAI-compatible) | MVP |
| Grid map with named locations | MVP |
| Characters: goals, traits, skills, needs, relationships, memories | MVP |
| Discrete tick engine + action queue | MVP |
| Limited knowledge / local observation | MVP |
| Memory store + summarization of older entries | MVP |
| Pixel-art inspired UI + controls | MVP |
| Save / load / reset | MVP |
| Scenario fork + comparison metrics | MVP |
| Demo mode without API keys | MVP |
| Image generation / god-mode chat | Out of scope MVP |

## AI capabilities

### World generation

- **Inputs:** prompt text, seed, optional provider config
- **Outputs:** `WorldBlueprint` JSON validated by Zod
- **Failures:** malformed JSON → repair attempt once → fall back to rule-based template filled from keywords
- **Inference:** local rules by default; remote OpenAI-compatible chat when configured

### Character decisions

- **Inputs:** local observation, memories, needs, legal action list
- **Outputs:** proposed `Action` + short rationale string
- **Failures:** invalid action → reject and pick highest-scoring legal rule-based action
- **Inference:** rule-based scoring always available; LLM optional and validated as untrusted

## Non-goals (MVP)

- Multiplayer / accounts
- Photoreal or generated map art pipelines
- Voice / likeness cloning
- Unbounded world sizes

## License proposal

**MIT** is proposed: simple, portfolio-friendly, matches common OSS practice and the license of the inspiration project (without incorporating its code). Alternatives: Apache-2.0 (patent grant) or GPL-3.0 (copyleft). Default for this repository: **MIT**.
