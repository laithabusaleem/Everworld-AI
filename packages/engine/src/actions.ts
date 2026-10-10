import { addMemory, updateRelationship } from "./memory.js";
import type { Action, Character, WorldState } from "./schemas.js";
import { ActionSchema } from "./schemas.js";

function socialRules(state: WorldState) {
  return (
    state.settings.socialRules[0] ?? {
      id: "default",
      name: "Default",
      description: "Default social rules",
      requireTrustForTrade: false,
      allowCellSharing: false,
      allowResourceDebt: false,
    }
  );
}

export function listLegalActions(state: WorldState, actor: Character): Action[] {
  const actions: Action[] = [
    { type: "wait", actorId: actor.id, rationale: "Wait and observe." },
    { type: "rest", actorId: actor.id, rationale: "Recover energy." },
  ];

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  for (const d of dirs) {
    const nx = actor.x + d.dx;
    const ny = actor.y + d.dy;
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= state.settings.width ||
      ny >= state.settings.height
    ) {
      continue;
    }
    const terrain = state.terrain[ny]?.[nx];
    if (terrain === "water" || terrain === "rock") continue;
    const occupied = state.characters.some(
      (c) => c.id !== actor.id && c.x === nx && c.y === ny,
    );
    if (occupied && !socialRules(state).allowCellSharing) continue;
    actions.push({
      type: "move",
      actorId: actor.id,
      dx: d.dx,
      dy: d.dy,
      rationale: `Move toward (${nx},${ny}).`,
    });
  }

  const hereResource = state.resources.find(
    (r) => r.x === actor.x && r.y === actor.y && r.amount > 0,
  );
  if (hereResource) {
    actions.push({
      type: "gather",
      actorId: actor.id,
      resourceKind: hereResource.kind,
      amount: 1,
      rationale: `Gather ${hereResource.kind}.`,
    });
  }

  if ((actor.inventory.food ?? 0) > 0) {
    actions.push({
      type: "eat",
      actorId: actor.id,
      resourceKind: "food",
      amount: 1,
      rationale: "Eat stored food.",
    });
  }

  const nearby = state.characters.filter(
    (c) =>
      c.id !== actor.id &&
      Math.abs(c.x - actor.x) <= 1 &&
      Math.abs(c.y - actor.y) <= 1,
  );
  for (const other of nearby) {
    actions.push({
      type: "talk",
      actorId: actor.id,
      targetId: other.id,
      message: `Hello ${other.name}.`,
      rationale: `Speak with ${other.name}.`,
    });
    const food = actor.inventory.food ?? 0;
    if (food > 0) {
      const rel = actor.relationships.find((r) => r.targetId === other.id);
      const trustOk =
        !socialRules(state).requireTrustForTrade || (rel?.trust ?? 0) >= 10;
      if (trustOk) {
        actions.push({
          type: "trade",
          actorId: actor.id,
          targetId: other.id,
          resourceKind: "food",
          amount: 1,
          rationale: `Offer food to ${other.name}.`,
        });
      }
    }
  }

  const workLoc = state.locations.find(
    (l) =>
      l.x === actor.x &&
      l.y === actor.y &&
      (l.tags.includes("work") || l.tags.includes("market")),
  );
  if (workLoc) {
    actions.push({
      type: "work",
      actorId: actor.id,
      targetId: workLoc.id,
      rationale: `Work at ${workLoc.name}.`,
    });
  }

  return actions;
}

/** Apply a previously validated action. Callers must run validateAction first. */
export function applyAction(state: WorldState, raw: Action): WorldState {
  const action = ActionSchema.parse(raw);
  const actor = state.characters.find((c) => c.id === action.actorId);
  if (!actor) throw new Error("Actor missing");

  let next = { ...state };
  const pushFeed = (text: string, severity: "info" | "tension" | "crisis" = "info") => {
    next = {
      ...next,
      feed: [
        ...next.feed,
        {
          id: `feed_${next.tick}_${next.feed.length}`,
          tick: next.tick,
          text,
          severity,
          characterIds: [action.actorId, action.targetId].filter(
            Boolean,
          ) as string[],
        },
      ].slice(-200),
    };
  };

  switch (action.type) {
    case "wait": {
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        needs: { ...c.needs, energy: Math.min(100, c.needs.energy + 1) },
      }));
      break;
    }
    case "rest": {
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        needs: {
          ...c.needs,
          energy: Math.min(100, c.needs.energy + 12),
          hunger: Math.min(100, c.needs.hunger + 2),
        },
      }));
      pushFeed(`${actor.name} rests.`);
      break;
    }
    case "move": {
      const nx = actor.x + (action.dx ?? 0);
      const ny = actor.y + (action.dy ?? 0);
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        x: nx,
        y: ny,
        needs: {
          ...c.needs,
          energy: Math.max(0, c.needs.energy - 2),
        },
      }));
      break;
    }
    case "gather": {
      const kind = action.resourceKind ?? "food";
      const resources = next.resources.map((r) => {
        if (r.x === actor.x && r.y === actor.y && r.kind === kind && r.amount > 0) {
          return { ...r, amount: r.amount - 1 };
        }
        return r;
      });
      next = {
        ...next,
        resources,
      };
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          [kind]: (c.inventory[kind] ?? 0) + 1,
        },
        needs: {
          ...c.needs,
          energy: Math.max(0, c.needs.energy - 3),
        },
      }));
      pushFeed(`${actor.name} gathers ${kind}.`);
      next = patchCharacter(next, action.actorId, (c) =>
        addMemory(
          c,
          {
            tick: next.tick,
            kind: "episodic",
            text: `Gathered ${kind} at (${actor.x},${actor.y}).`,
            importance: 0.4,
            subjects: [kind],
          },
          next.settings.memoryCap,
        ),
      );
      break;
    }
    case "eat": {
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          food: Math.max(0, (c.inventory.food ?? 0) - 1),
        },
        needs: {
          ...c.needs,
          hunger: Math.max(0, c.needs.hunger - 25),
          energy: Math.min(100, c.needs.energy + 5),
        },
      }));
      pushFeed(`${actor.name} eats.`);
      break;
    }
    case "talk": {
      const other = next.characters.find((c) => c.id === action.targetId);
      if (!other) break;
      next = updateRelationship(next, action.actorId, other.id, {
        familiarity: 5,
        trust: 2,
      });
      next = updateRelationship(next, other.id, action.actorId, {
        familiarity: 5,
        trust: 2,
      });
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        needs: {
          ...c.needs,
          social: Math.min(100, c.needs.social + 10),
        },
        knownFacts: unique([
          ...c.knownFacts,
          ...other.knownFacts.filter((f) => !f.startsWith("private:")),
        ]),
      }));
      next = patchCharacter(next, other.id, (c) => ({
        ...c,
        needs: {
          ...c.needs,
          social: Math.min(100, c.needs.social + 8),
        },
      }));
      const msg = action.message ?? "exchanges news";
      pushFeed(`${actor.name} talks with ${other.name}: "${msg}"`);
      next = patchCharacter(next, action.actorId, (c) =>
        addMemory(
          c,
          {
            tick: next.tick,
            kind: "social",
            text: `Spoke with ${other.name}: ${msg}`,
            importance: 0.5,
            subjects: [other.id],
          },
          next.settings.memoryCap,
        ),
      );
      break;
    }
    case "trade": {
      const other = next.characters.find((c) => c.id === action.targetId);
      if (!other) break;
      const kind = action.resourceKind ?? "food";
      const amount = action.amount ?? 1;
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          [kind]: (c.inventory[kind] ?? 0) - amount,
        },
      }));
      next = patchCharacter(next, other.id, (c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          [kind]: (c.inventory[kind] ?? 0) + amount,
        },
      }));
      next = updateRelationship(next, action.actorId, other.id, {
        trust: 4,
        familiarity: 3,
        alliance: true,
      });
      next = updateRelationship(next, other.id, action.actorId, {
        trust: 4,
        familiarity: 3,
        alliance: true,
      });
      pushFeed(`${actor.name} gives ${amount} ${kind} to ${other.name}.`);
      break;
    }
    case "work": {
      const pay = Math.max(1, Math.round(2 * state.settings.resourceAbundance));
      next = patchCharacter(next, action.actorId, (c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          coin: (c.inventory.coin ?? 0) + pay,
          food: (c.inventory.food ?? 0) + (state.settings.foodScarcity < 0.5 ? 1 : 0),
        },
        needs: {
          ...c.needs,
          energy: Math.max(0, c.needs.energy - 8),
          hunger: Math.min(100, c.needs.hunger + 3),
        },
      }));
      pushFeed(`${actor.name} works and earns ${pay} coin.`);
      break;
    }
    default:
      break;
  }

  next = patchCharacter(next, action.actorId, (c) => ({
    ...c,
    lastDecision: {
      tick: next.tick,
      actionType: action.type,
      rationale: action.rationale ?? action.type,
      source: "rules",
    },
  }));

  return next;
}

function patchCharacter(
  state: WorldState,
  id: string,
  fn: (c: Character) => Character,
): WorldState {
  return {
    ...state,
    characters: state.characters.map((c) => (c.id === id ? fn(c) : c)),
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
