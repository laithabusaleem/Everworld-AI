import { createRng } from "./rng.js";
import type {
  MetricsSnapshot,
  SocialRule,
  WorldSettings,
  WorldState,
} from "./schemas.js";
import { cloneState, SimulationEngine } from "./simulate.js";
import { RuleBasedDecisionProvider } from "./decide.js";

export type ExperimentVariable =
  | "foodScarcity"
  | "resourceAbundance"
  | "requireTrustForTrade";

export type ExperimentSpec = {
  id: string;
  name: string;
  variable: ExperimentVariable;
  value: number | boolean;
  ticks: number;
  seed: number;
};

export type ExperimentBranchResult = {
  label: string;
  worldId: string;
  finalState: WorldState;
  metrics: MetricsSnapshot[];
};

export type ExperimentResult = {
  spec: ExperimentSpec;
  control: ExperimentBranchResult;
  treatment: ExperimentBranchResult;
  notes: string[];
};

export function forkWorld(
  original: WorldState,
  newId: string,
  patch: {
    settings?: Partial<WorldSettings>;
    socialRulePatch?: Partial<SocialRule>;
    experimentVariable?: string;
  },
): WorldState {
  const forked = cloneState(original);
  // Reset runtime progression so forks share equivalent initial conditions
  const baseSettings = {
    ...forked.settings,
    ...patch.settings,
  };
  let socialRules = baseSettings.socialRules;
  if (patch.socialRulePatch) {
    const current = socialRules[0] ?? {
      id: "default",
      name: "Default",
      description: "Default",
      requireTrustForTrade: false,
      allowCellSharing: false,
      allowResourceDebt: false,
    };
    socialRules = [{ ...current, ...patch.socialRulePatch }];
  }

  return {
    ...forked,
    id: newId,
    tick: 0,
    feed: [
      {
        id: "feed_fork",
        tick: 0,
        text: `Forked from ${original.id} for experiment.`,
        severity: "info",
        characterIds: [],
      },
    ],
    metricsHistory: [],
    status: "ready",
    parentWorldId: original.id,
    experimentVariable: patch.experimentVariable,
    settings: { ...baseSettings, socialRules },
    events: forked.events.map((e) => ({ ...e, processed: false })),
    characters: forked.characters.map((c) => ({
      ...c,
      // Keep inventories/needs/positions from snapshot; clear lastDecision
      lastDecision: undefined,
    })),
  };
}

export function applyExperimentVariable(
  state: WorldState,
  variable: ExperimentVariable,
  value: number | boolean,
  newId: string,
): WorldState {
  switch (variable) {
    case "foodScarcity":
      return forkWorld(state, newId, {
        settings: { foodScarcity: Number(value) },
        experimentVariable: `foodScarcity=${value}`,
      });
    case "resourceAbundance":
      return forkWorld(state, newId, {
        settings: { resourceAbundance: Number(value) },
        experimentVariable: `resourceAbundance=${value}`,
      });
    case "requireTrustForTrade":
      return forkWorld(state, newId, {
        socialRulePatch: { requireTrustForTrade: Boolean(value) },
        experimentVariable: `requireTrustForTrade=${value}`,
      });
    default:
      throw new Error(`Unknown variable: ${variable}`);
  }
}

/**
 * Run control (unmodified fork) vs treatment (variable changed) for N ticks.
 * Uses rule-based decisions for reproducibility. LLM stochasticity is documented
 * separately when LLM providers are enabled.
 */
export async function runExperiment(
  initialSnapshot: WorldState,
  spec: ExperimentSpec,
): Promise<ExperimentResult> {
  const controlId = `${spec.id}_control`;
  const treatmentId = `${spec.id}_treatment`;

  const controlState = forkWorld(initialSnapshot, controlId, {
    experimentVariable: "control",
  });
  // Align seed for both branches
  controlState.seed = spec.seed;

  const treatmentState = applyExperimentVariable(
    initialSnapshot,
    spec.variable,
    spec.value,
    treatmentId,
  );
  treatmentState.seed = spec.seed;

  const controlEngine = new SimulationEngine(controlState, {
    decisionProvider: new RuleBasedDecisionProvider(),
    rng: createRng(spec.seed),
  });
  // Same seed so divergence is attributable to the experimental variable
  // under rule-based decisions (not RNG drift).
  const treatmentEngine = new SimulationEngine(treatmentState, {
    decisionProvider: new RuleBasedDecisionProvider(),
    rng: createRng(spec.seed),
  });

  await controlEngine.run(spec.ticks);
  await treatmentEngine.run(spec.ticks);

  return {
    spec,
    control: {
      label: "Control",
      worldId: controlId,
      finalState: controlEngine.getState(),
      metrics: controlEngine.getState().metricsHistory,
    },
    treatment: {
      label: `Treatment (${spec.variable}=${String(spec.value)})`,
      worldId: treatmentId,
      finalState: treatmentEngine.getState(),
      metrics: treatmentEngine.getState().metricsHistory,
    },
    notes: [
      "Both branches started from an equivalent cloned snapshot.",
      "Rule-based decisions were used for this experiment run.",
      "If LLM decisions are enabled in interactive play, exact reproducibility is not guaranteed unless model outputs are recorded and replayed.",
      `Random seed recorded: ${spec.seed}`,
    ],
  };
}
