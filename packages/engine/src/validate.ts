import type { Action, WorldState } from "./schemas.js";
import { ActionSchema } from "./schemas.js";
import { listLegalActions } from "./actions.js";

export type ValidationResult =
  | { ok: true; action: Action }
  | { ok: false; reason: string };

function socialRules(state: WorldState) {
  return (
    state.settings.socialRules[0] ?? {
      id: "default",
      name: "Default",
      description: "Default",
      requireTrustForTrade: false,
      allowCellSharing: false,
      allowResourceDebt: false,
    }
  );
}

/** Validate a proposed action against schema and world rules. */
export function validateAction(
  state: WorldState,
  raw: unknown,
): ValidationResult {
  const parsed = ActionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }
  const action = parsed.data;
  const actor = state.characters.find((c) => c.id === action.actorId);
  if (!actor) {
    return { ok: false, reason: "Unknown actor" };
  }

  const legal = listLegalActions(state, actor);
  const match = legal.find((a) => actionEquals(a, action));
  if (!match) {
    // Still allow exact structural checks for LLM near-misses on rationale-only diffs
    const structural = legal.find((a) => actionKey(a) === actionKey(action));
    if (!structural) {
      return { ok: false, reason: "Action not legal in current world state" };
    }
  }

  if (action.type === "move") {
    const dx = action.dx ?? 0;
    const dy = action.dy ?? 0;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return { ok: false, reason: "Movement must be exactly one cardinal step" };
    }
    const nx = actor.x + dx;
    const ny = actor.y + dy;
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= state.settings.width ||
      ny >= state.settings.height
    ) {
      return { ok: false, reason: "Movement off map" };
    }
    const terrain = state.terrain[ny]?.[nx];
    if (terrain === "water" || terrain === "rock") {
      return { ok: false, reason: "Impassable terrain" };
    }
    const occupied = state.characters.some(
      (c) => c.id !== actor.id && c.x === nx && c.y === ny,
    );
    if (occupied && !socialRules(state).allowCellSharing) {
      return { ok: false, reason: "Cell occupied" };
    }
  }

  if (action.type === "gather") {
    const kind = action.resourceKind ?? "food";
    const node = state.resources.find(
      (r) =>
        r.x === actor.x &&
        r.y === actor.y &&
        r.kind === kind &&
        r.amount > 0,
    );
    if (!node) {
      return { ok: false, reason: "No resource to gather here" };
    }
  }

  if (action.type === "eat") {
    if ((actor.inventory.food ?? 0) < 1) {
      return { ok: false, reason: "No food to eat" };
    }
  }

  if (action.type === "trade") {
    const kind = action.resourceKind ?? "food";
    const amount = action.amount ?? 1;
    if ((actor.inventory[kind] ?? 0) < amount) {
      return { ok: false, reason: "Insufficient inventory for trade" };
    }
    if (!socialRules(state).allowResourceDebt) {
      const after = (actor.inventory[kind] ?? 0) - amount;
      if (after < 0) {
        return { ok: false, reason: "Trade would create negative resources" };
      }
    }
    const other = state.characters.find((c) => c.id === action.targetId);
    if (!other) {
      return { ok: false, reason: "Trade target missing" };
    }
    if (
      Math.abs(other.x - actor.x) > 1 ||
      Math.abs(other.y - actor.y) > 1
    ) {
      return { ok: false, reason: "Trade target out of range" };
    }
    // Limited knowledge: cannot trade with someone not locally observed
    // (range check above encodes this)
    if (socialRules(state).requireTrustForTrade) {
      const rel = actor.relationships.find((r) => r.targetId === other.id);
      if ((rel?.trust ?? 0) < 10) {
        return { ok: false, reason: "Social rule: trust required for trade" };
      }
    }
  }

  if (action.type === "talk") {
    const other = state.characters.find((c) => c.id === action.targetId);
    if (!other) {
      return { ok: false, reason: "Talk target missing" };
    }
    if (
      Math.abs(other.x - actor.x) > 1 ||
      Math.abs(other.y - actor.y) > 1
    ) {
      return { ok: false, reason: "Talk target out of range / unknown locally" };
    }
  }

  return { ok: true, action };
}

function actionKey(a: Action): string {
  return [
    a.type,
    a.actorId,
    a.targetId ?? "",
    a.resourceKind ?? "",
    a.amount ?? "",
    a.dx ?? "",
    a.dy ?? "",
  ].join("|");
}

function actionEquals(a: Action, b: Action): boolean {
  return actionKey(a) === actionKey(b);
}

/** Assert world-wide invariants after a tick. */
export function assertInvariants(state: WorldState): void {
  const allowDebt = socialRules(state).allowResourceDebt;
  for (const c of state.characters) {
    if (
      c.x < 0 ||
      c.y < 0 ||
      c.x >= state.settings.width ||
      c.y >= state.settings.height
    ) {
      throw new Error(`Character ${c.id} off map`);
    }
    for (const [k, v] of Object.entries(c.inventory)) {
      if (!allowDebt && v < 0) {
        throw new Error(`Negative inventory ${k} for ${c.id}`);
      }
    }
    for (const need of Object.values(c.needs)) {
      if (need < 0 || need > 100) {
        throw new Error(`Need out of bounds for ${c.id}`);
      }
    }
  }
  for (const r of state.resources) {
    if (!allowDebt && r.amount < 0) {
      throw new Error(`Negative resource node ${r.id}`);
    }
  }
  if (!socialRules(state).allowCellSharing) {
    const cells = new Map<string, string>();
    for (const c of state.characters) {
      const key = `${c.x},${c.y}`;
      const prev = cells.get(key);
      if (prev) {
        throw new Error(`Collision at ${key}: ${prev} and ${c.id}`);
      }
      cells.set(key, c.id);
    }
  }
}
