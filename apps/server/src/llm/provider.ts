import {
  generateWorldRules,
  parseBlueprintJson,
  type DecisionProvider,
  type Observation,
  type WorldBlueprint,
  LlmDecisionProvider,
  RuleBasedDecisionProvider,
} from "@everworld/engine";
import type { AppConfig } from "../config.js";
import { llmConfigured } from "../config.js";
import { logger } from "../logger.js";

export type ModelFacade = {
  mode: "rules" | "openai";
  generateWorld: (input: {
    description: string;
    seed?: number;
    name?: string;
  }) => Promise<WorldBlueprint>;
  createDecisionProvider: () => DecisionProvider;
};

export function createModelFacade(config: AppConfig): ModelFacade {
  const useLlm = llmConfigured(config);

  return {
    mode: useLlm ? "openai" : "rules",

    async generateWorld(input) {
      if (!useLlm) {
        return generateWorldRules(input);
      }
      try {
        const blueprint = await generateWorldWithLlm(config, input);
        return blueprint;
      } catch (err) {
        logger.warn("LLM world generation failed; using rules fallback", {
          error: err instanceof Error ? err.message : String(err),
        });
        return generateWorldRules(input);
      }
    },

    createDecisionProvider() {
      if (!useLlm) {
        return new RuleBasedDecisionProvider();
      }
      return new LlmDecisionProvider(async (observation) => {
        return proposeActionWithLlm(config, observation);
      });
    },
  };
}

async function generateWorldWithLlm(
  config: AppConfig,
  input: { description: string; seed?: number; name?: string },
): Promise<WorldBlueprint> {
  const system = `You are a world designer for a grid-based society simulator.
Return ONLY valid JSON matching this shape:
{
  "name": string,
  "description": string,
  "seed": number,
  "settings": { "width": 12, "height": 12, "foodScarcity": 0-1, "resourceAbundance": 0-1, "tickHungerDrain": number, "memoryCap": 16, "maxActionsPerCharacterPerTick": 1, "socialRules": [] },
  "terrain": string[height][width] with values water|sand|grass|path|building|rock|forest,
  "locations": [{id,name,x,y,description,tags}],
  "characters": [{id,name,role,traits,skills,goals,x,y,inventory,needs:{hunger,energy,social,safety},memories,relationships,knownFacts}],
  "resources": [{id,kind,amount,x,y,renewable}],
  "events": [{id,tick,title,description,severity,locationId?,characterIds,public,processed}],
  "tensions": string[]
}
Keep width/height at 12. Create 4-6 characters. Do not invent API keys or secrets.`;

  const user = `Description: ${input.description}
Seed: ${input.seed ?? 42}
Optional name: ${input.name ?? ""}`;

  const content = await chatCompletion(config, system, user);
  const json = extractJson(content);
  return parseBlueprintJson(json);
}

async function proposeActionWithLlm(
  config: AppConfig,
  observation: Observation,
): Promise<{
  type: Observation["legalActions"][number]["type"];
  targetId?: string;
  resourceKind?: string;
  amount?: number;
  dx?: number;
  dy?: number;
  message?: string;
  rationale?: string;
}> {
  const system = `You choose ONE action for a character in a grid society sim.
Return ONLY JSON: {"type":"...","targetId?":"...","resourceKind?":"...","amount?":1,"dx?":-1|0|1,"dy?":-1|0|1,"message?":"...","rationale":"..."}
You MUST pick a type present in legalActions. Characters only know local observations.`;

  const user = JSON.stringify({
    legalActions: observation.legalActions,
    needs: observation.needs,
    goals: observation.goals,
    nearbyCharacters: observation.nearbyCharacters,
    nearbyResources: observation.nearbyResources,
    memories: observation.relevantMemories,
  });

  const content = await chatCompletion(config, system, user);
  const json = extractJson(content) as {
    type: Observation["legalActions"][number]["type"];
    targetId?: string;
    resourceKind?: string;
    amount?: number;
    dx?: number;
    dy?: number;
    message?: string;
    rationale?: string;
  };
  return json;
}

async function chatCompletion(
  config: AppConfig,
  system: string,
  user: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON from model output");
  }
}
