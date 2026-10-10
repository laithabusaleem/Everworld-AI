import type { Rng } from "./rng.js";
import type { Action, Observation } from "./schemas.js";

export type DecisionResult = {
  action: Action;
  rationale: string;
  source: "rules" | "llm" | "fallback";
};

export interface DecisionProvider {
  decide(observation: Observation, rng: Rng): Promise<DecisionResult>;
}

function scoreAction(obs: Observation, action: Action): number {
  let score = 0;
  const { needs, inventory } = obs;

  switch (action.type) {
    case "eat":
      score += needs.hunger * 2;
      break;
    case "gather":
      score += needs.hunger * 1.2 + ((inventory.food ?? 0) < 2 ? 40 : 10);
      if (action.resourceKind === "food") score += obs.goals.some((g) =>
        g.toLowerCase().includes("food"),
      )
        ? 20
        : 0;
      break;
    case "rest":
      score += (100 - needs.energy) * 1.5;
      break;
    case "talk":
      score += (100 - needs.social) * 1.2;
      {
        const rel = obs.relationships.find((r) => r.targetId === action.targetId);
        if (rel?.conflict && rel.conflict > 40) score -= 15;
        if (rel?.alliance) score += 10;
      }
      break;
    case "trade":
      score += needs.social * 0.5;
      if ((inventory.food ?? 0) > 3) score += 25;
      if (obs.goals.some((g) => g.toLowerCase().includes("alliance"))) score += 20;
      break;
    case "work":
      score += 30 + (100 - needs.energy) * -0.2;
      if (obs.goals.some((g) => /coin|wealth|merchant|trade/i.test(g))) score += 35;
      break;
    case "move": {
      // Bias toward nearby food or work locations
      const food = obs.nearbyResources.find((r) => r.kind === "food");
      if (food && action.dx !== undefined && action.dy !== undefined) {
        const nx = obs.position.x + action.dx;
        const ny = obs.position.y + action.dy;
        const before =
          Math.abs(food.x - obs.position.x) + Math.abs(food.y - obs.position.y);
        const after = Math.abs(food.x - nx) + Math.abs(food.y - ny);
        if (after < before) score += 25 + needs.hunger * 0.5;
      }
      const market = obs.nearbyLocations.find((l) =>
        l.tags.includes("market") || l.tags.includes("work"),
      );
      if (market && action.dx !== undefined && action.dy !== undefined) {
        const nx = obs.position.x + action.dx;
        const ny = obs.position.y + action.dy;
        const before =
          Math.abs(market.x - obs.position.x) +
          Math.abs(market.y - obs.position.y);
        const after = Math.abs(market.x - nx) + Math.abs(market.y - ny);
        if (after < before) score += 15;
      }
      score += 5;
      break;
    }
    case "wait":
      score += 1;
      break;
    default:
      score += 0;
  }

  // Soft anti-loop: prefer not repeating identical move forever via slight noise later
  return score;
}

export class RuleBasedDecisionProvider implements DecisionProvider {
  async decide(observation: Observation, rng: Rng): Promise<DecisionResult> {
    const legal = observation.legalActions;
    if (legal.length === 0) {
      return {
        action: { type: "wait", actorId: observation.actorId },
        rationale: "No legal actions; waiting.",
        source: "fallback",
      };
    }

    let best = legal[0]!;
    let bestScore = -Infinity;
    for (const action of legal) {
      const jitter = rng.next() * 8;
      const s = scoreAction(observation, action) + jitter;
      if (s > bestScore) {
        bestScore = s;
        best = action;
      }
    }

    const rationale =
      best.rationale ??
      `Chose ${best.type} based on needs (hunger=${observation.needs.hunger.toFixed(0)}, energy=${observation.needs.energy.toFixed(0)}, social=${observation.needs.social.toFixed(0)}).`;

    return {
      action: { ...best, rationale },
      rationale,
      source: "rules",
    };
  }
}

/**
 * Wraps an async LLM proposer. Model output is untrusted and must validate.
 * On failure, falls back to rule-based decision.
 */
export class LlmDecisionProvider implements DecisionProvider {
  private fallback = new RuleBasedDecisionProvider();

  constructor(
    private readonly propose: (
      observation: Observation,
    ) => Promise<Partial<Action> & { type: Action["type"]; rationale?: string }>,
  ) {}

  async decide(observation: Observation, rng: Rng): Promise<DecisionResult> {
    try {
      const proposed = await this.propose(observation);
      const candidate: Action = {
        type: proposed.type,
        actorId: observation.actorId,
        targetId: proposed.targetId,
        resourceKind: proposed.resourceKind,
        amount: proposed.amount,
        dx: proposed.dx,
        dy: proposed.dy,
        message: proposed.message,
        rationale: proposed.rationale,
      };
      const key = (a: Action) =>
        [a.type, a.targetId ?? "", a.resourceKind ?? "", a.dx ?? "", a.dy ?? ""].join(
          "|",
        );
      const legal = observation.legalActions.find((a) => key(a) === key(candidate));
      if (!legal) {
        return this.fallback.decide(observation, rng);
      }
      return {
        action: {
          ...legal,
          rationale: proposed.rationale ?? legal.rationale,
          message: proposed.message ?? legal.message,
        },
        rationale: proposed.rationale ?? legal.rationale ?? legal.type,
        source: "llm",
      };
    } catch {
      const fb = await this.fallback.decide(observation, rng);
      return { ...fb, source: "fallback" };
    }
  }
}
