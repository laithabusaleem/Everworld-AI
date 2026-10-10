export type Meta = {
  name: string;
  version: string;
  provider: string;
  llmConfigured: boolean;
  demoMode: boolean;
};

export type WorldSummary = {
  id: string;
  name: string;
  description: string;
  seed: number;
  status: string;
  parentWorldId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Character = {
  id: string;
  name: string;
  role: string;
  traits: string[];
  skills: Record<string, number>;
  goals: string[];
  x: number;
  y: number;
  inventory: Record<string, number>;
  needs: {
    hunger: number;
    energy: number;
    social: number;
    safety: number;
  };
  memories: Array<{
    id: string;
    tick: number;
    kind: string;
    text: string;
    importance: number;
    subjects: string[];
    private: boolean;
  }>;
  relationships: Array<{
    targetId: string;
    trust: number;
    familiarity: number;
    conflict: number;
    alliance: boolean;
    notes: string;
  }>;
  knownFacts: string[];
  lastDecision?: {
    tick: number;
    actionType: string;
    rationale: string;
    source: string;
  };
};

export type WorldState = {
  id: string;
  name: string;
  description: string;
  seed: number;
  tick: number;
  status: string;
  terrain: string[][];
  locations: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    description: string;
    tags: string[];
  }>;
  characters: Character[];
  resources: Array<{
    id: string;
    kind: string;
    amount: number;
    x: number;
    y: number;
  }>;
  events: Array<{
    id: string;
    tick: number;
    title: string;
    description: string;
    severity: string;
    public: boolean;
    processed: boolean;
  }>;
  tensions: string[];
  feed: Array<{
    id: string;
    tick: number;
    text: string;
    severity: string;
    characterIds: string[];
  }>;
  metricsHistory: Array<{
    tick: number;
    population: number;
    totalFood: number;
    totalResources: number;
    allianceCount: number;
    conflictEvents: number;
    averageHunger: number;
    averageTrust: number;
  }>;
  settings: {
    width: number;
    height: number;
    foodScarcity: number;
    resourceAbundance: number;
    socialRules: Array<{
      requireTrustForTrade?: boolean;
      allowCellSharing?: boolean;
      allowResourceDebt?: boolean;
    }>;
  };
  parentWorldId?: string;
  experimentVariable?: string;
};

export type Blueprint = Omit<
  WorldState,
  "id" | "tick" | "feed" | "metricsHistory" | "status" | "parentWorldId" | "experimentVariable"
> & {
  settings: WorldState["settings"];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export const api = {
  meta: () => request<Meta>("/api/meta"),
  listWorlds: () => request<{ worlds: WorldSummary[] }>("/api/worlds"),
  getWorld: (id: string) => request<{ world: WorldState }>(`/api/worlds/${id}`),
  createExample: (seed = 42) =>
    request<{ world: WorldState }>("/api/worlds/example", {
      method: "POST",
      body: JSON.stringify({ seed }),
    }),
  generate: (body: {
    description: string;
    seed?: number;
    name?: string;
    previewOnly?: boolean;
  }) =>
    request<{ world?: WorldState; blueprint?: Blueprint; provider: string }>(
      "/api/worlds/generate",
      { method: "POST", body: JSON.stringify(body) },
    ),
  fromBlueprint: (blueprint: Blueprint) =>
    request<{ world: WorldState }>("/api/worlds/from-blueprint", {
      method: "POST",
      body: JSON.stringify({ blueprint }),
    }),
  tick: (id: string, count = 1) =>
    request<{ world: WorldState }>(`/api/worlds/${id}/tick`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),
  play: (id: string, tickMs = 700) =>
    request<{ ok: boolean }>(`/api/worlds/${id}/play`, {
      method: "POST",
      body: JSON.stringify({ tickMs }),
    }),
  pause: (id: string) =>
    request<{ world: WorldState }>(`/api/worlds/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  reset: (id: string) =>
    request<{ world: WorldState }>(`/api/worlds/${id}/reset`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  snapshot: (id: string, label: string) =>
    request<{ snapshotId: string }>(`/api/worlds/${id}/snapshot`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  runExperiment: (body: {
    sourceWorldId: string;
    variable: string;
    value: number | boolean;
    ticks?: number;
    seed?: number;
    name?: string;
  }) =>
    request<{ experiment: ExperimentResult }>("/api/experiments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getExperiment: (id: string) =>
    request<{ experiment: ExperimentResult }>(`/api/experiments/${id}`),
  listExperiments: () =>
    request<{ experiments: unknown[] }>("/api/experiments"),
  deleteWorld: (id: string) =>
    request<{ ok: boolean }>(`/api/worlds/${id}`, { method: "DELETE" }),
};

export type ExperimentResult = {
  id: string;
  name: string;
  sourceWorldId: string;
  variable: string;
  value: number | boolean;
  ticks: number;
  seed: number;
  notes: string[];
  control: {
    worldId: string;
    label: string;
    metrics: WorldState["metricsHistory"];
    finalTick: number;
  };
  treatment: {
    worldId: string;
    label: string;
    metrics: WorldState["metricsHistory"];
    finalTick: number;
  };
};
