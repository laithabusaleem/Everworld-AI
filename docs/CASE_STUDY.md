# Technical case study: Experimental Worlds

## Problem

When exploring emergent societies, changing one social or economic assumption usually means rebuilding a scenario by hand. It is hard to tell whether a different outcome came from the changed rule or from a different random start.

## Approach

Everworld AI treats a saved world snapshot as an experimental subject:

1. Clone the initial snapshot into **control** and **treatment** branches.
2. Apply exactly one variable patch (`foodScarcity`, `resourceAbundance`, or `requireTrustForTrade`).
3. Run both branches for N ticks with the same seed under the rule-based decision provider.
4. Persist per-tick metrics and chart them in the UI.

The original world row in SQLite is never written during the experiment. Forked worlds are stored separately for inspection.

## Why it matters

This turns the simulator into a lightweight causal sandbox for multi-agent systems: students can ask “what if food is scarcer?” and answer with recorded metrics rather than vibes. The UI explicitly warns that enabling stochastic LLM decisions breaks exact reproducibility unless model I/O is recorded.

## Verification

- Engine test: fork leaves the original JSON unchanged; experiment metrics length equals tick count.
- API test: experiment endpoint leaves the source world byte-identical in the database.
