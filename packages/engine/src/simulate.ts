import { applyAction } from "./actions.js";
import type { DecisionProvider } from "./decide.js";
import { RuleBasedDecisionProvider } from "./decide.js";
import { addMemory } from "./memory.js";
import { collectMetrics } from "./metrics.js";
import { observe } from "./observe.js";
import { createRng, type Rng } from "./rng.js";
import type { Action, WorldState } from "./schemas.js";
import { WorldStateSchema } from "./schemas.js";
import { assertInvariants, validateAction } from "./validate.js";

export type SimulationOptions = {
  decisionProvider?: DecisionProvider;
  rng?: Rng;
  /** Prevent identical action spam via recent signature tracking */
  antiLoopWindow?: number;
};

export class SimulationEngine {
  private recentActions = new Map<string, string[]>();
  private decisionProvider: DecisionProvider;
  private rng: Rng;
  private antiLoopWindow: number;

  constructor(
    public state: WorldState,
    options: SimulationOptions = {},
  ) {
    this.state = WorldStateSchema.parse(state);
    this.decisionProvider =
      options.decisionProvider ?? new RuleBasedDecisionProvider();
    this.rng = options.rng ?? createRng(this.state.seed);
    this.antiLoopWindow = options.antiLoopWindow ?? 4;
  }

  getState(): WorldState {
    return this.state;
  }

  setState(state: WorldState): void {
    this.state = WorldStateSchema.parse(state);
  }

  async tick(): Promise<WorldState> {
    let state: WorldState = {
      ...this.state,
      tick: this.state.tick + 1,
      status: "running",
    };

    state = processEvents(state);
    state = applyNeedDrift(state);

    // Stable order by id for determinism
    const actors = [...state.characters].sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    const appliedKeys = new Set<string>();

    for (const actor of actors) {
      // Refresh actor reference after prior mutations
      const current = state.characters.find((c) => c.id === actor.id);
      if (!current) continue;

      const observation = observe(state, current);
      let decision = await this.decisionProvider.decide(observation, this.rng);

      // Anti-loop: if same action signature repeats, prefer wait/rest/alternative
      const sig = actionSignature(decision.action);
      const history = this.recentActions.get(actor.id) ?? [];
      if (
        history.length >= this.antiLoopWindow &&
        history.every((h) => h === sig) &&
        decision.action.type === "move"
      ) {
        const alt =
          observation.legalActions.find((a) => a.type === "rest") ??
          observation.legalActions.find((a) => a.type === "wait") ??
          decision.action;
        decision = {
          action: { ...alt, rationale: "Breaking a repetitive movement loop." },
          rationale: "Breaking a repetitive movement loop.",
          source: "fallback",
        };
      }

      const validated = validateAction(state, decision.action);
      let action: Action;
      let source = decision.source;
      let rationale = decision.rationale;

      if (!validated.ok) {
        const fallback = observation.legalActions.find((a) => a.type === "wait");
        if (!fallback) continue;
        action = {
          ...fallback,
          rationale: `Fallback after invalid proposal: ${validated.reason}`,
        };
        source = "fallback";
        rationale = action.rationale ?? rationale;
      } else {
        action = {
          ...validated.action,
          rationale: decision.rationale ?? validated.action.rationale,
        };
      }

      const dedupeKey = `${action.actorId}:${actionSignature(action)}`;
      if (appliedKeys.has(dedupeKey) && action.type !== "wait") {
        continue;
      }
      appliedKeys.add(dedupeKey);

      state = applyAction(state, action);
      state = {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.actorId
            ? {
                ...c,
                lastDecision: {
                  tick: state.tick,
                  actionType: action.type,
                  rationale,
                  source,
                },
              }
            : c,
        ),
      };

      const nextHistory = [...history, actionSignature(action)].slice(
        -this.antiLoopWindow,
      );
      this.recentActions.set(actor.id, nextHistory);
    }

    const metrics = collectMetrics(state);
    state = {
      ...state,
      metricsHistory: [...state.metricsHistory, metrics].slice(-2000),
    };

    assertInvariants(state);
    this.state = state;
    return state;
  }

  async run(ticks: number): Promise<WorldState> {
    for (let i = 0; i < ticks; i++) {
      await this.tick();
    }
    return this.state;
  }
}

function actionSignature(action: Action): string {
  return [
    action.type,
    action.targetId ?? "",
    action.resourceKind ?? "",
    action.dx ?? "",
    action.dy ?? "",
  ].join(":");
}

function applyNeedDrift(state: WorldState): WorldState {
  const drain = state.settings.tickHungerDrain * (0.5 + state.settings.foodScarcity);
  return {
    ...state,
    characters: state.characters.map((c) => ({
      ...c,
      needs: {
        hunger: Math.min(100, c.needs.hunger + drain),
        energy: Math.max(0, c.needs.energy - 0.8),
        social: Math.min(100, c.needs.social + 0.6),
        safety: c.needs.safety,
      },
    })),
  };
}

function processEvents(state: WorldState): WorldState {
  let next = state;
  const due = state.events.filter((e) => !e.processed && e.tick <= state.tick);
  for (const event of due) {
    next = {
      ...next,
      feed: [
        ...next.feed,
        {
          id: `feed_evt_${event.id}`,
          tick: state.tick,
          text: `Event: ${event.title} — ${event.description}`,
          severity: event.severity,
          characterIds: event.characterIds,
        },
      ],
      events: next.events.map((e) =>
        e.id === event.id ? { ...e, processed: true } : e,
      ),
    };

    if (event.public) {
      next = {
        ...next,
        characters: next.characters.map((c) => {
          const near =
            !event.locationId ||
            next.locations.some(
              (l) =>
                l.id === event.locationId &&
                Math.abs(l.x - c.x) <= 3 &&
                Math.abs(l.y - c.y) <= 3,
            );
          if (!near && !event.characterIds.includes(c.id)) {
            return c;
          }
          const withFact = {
            ...c,
            knownFacts: [...new Set([...c.knownFacts, event.id])],
          };
          return addMemory(
            withFact,
            {
              tick: state.tick,
              kind: "episodic",
              text: `Learned of event: ${event.title}`,
              importance: event.severity === "crisis" ? 0.9 : 0.6,
              subjects: event.characterIds,
            },
            next.settings.memoryCap,
          );
        }),
      };
    }

    // Rival tension bump
    if (event.severity === "tension" || event.severity === "crisis") {
      const ids = event.characterIds;
      if (ids.length >= 2) {
        const [a, b] = ids;
        next = {
          ...next,
          characters: next.characters.map((c) => {
            if (c.id !== a && c.id !== b) return c;
            const targetId = c.id === a ? b! : a!;
            const relationships = [...c.relationships];
            const idx = relationships.findIndex((r) => r.targetId === targetId);
            if (idx >= 0) {
              const r = relationships[idx]!;
              relationships[idx] = {
                ...r,
                conflict: Math.min(100, r.conflict + 8),
                trust: Math.max(-100, r.trust - 5),
              };
            }
            return { ...c, relationships };
          }),
        };
      }
    }
  }
  return next;
}

export function cloneState(state: WorldState): WorldState {
  return WorldStateSchema.parse(JSON.parse(JSON.stringify(state)));
}
