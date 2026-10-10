import { z } from "zod";

export const TerrainTypeSchema = z.enum([
  "water",
  "sand",
  "grass",
  "path",
  "building",
  "rock",
  "forest",
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const Vec2Schema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type Vec2 = z.infer<typeof Vec2Schema>;

export const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
});
export type Location = z.infer<typeof LocationSchema>;

export const NeedSchema = z.object({
  hunger: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  safety: z.number().min(0).max(100),
});
export type Need = z.infer<typeof NeedSchema>;

export const MemorySchema = z.object({
  id: z.string(),
  tick: z.number().int().nonnegative(),
  kind: z.enum(["episodic", "semantic", "social"]),
  text: z.string(),
  importance: z.number().min(0).max(1).default(0.5),
  subjects: z.array(z.string()).default([]),
  private: z.boolean().default(false),
});
export type Memory = z.infer<typeof MemorySchema>;

export const RelationshipSchema = z.object({
  targetId: z.string(),
  trust: z.number().min(-100).max(100),
  familiarity: z.number().min(0).max(100),
  conflict: z.number().min(0).max(100),
  alliance: z.boolean().default(false),
  notes: z.string().default(""),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  traits: z.array(z.string()).default([]),
  skills: z.record(z.number().min(0).max(100)).default({}),
  goals: z.array(z.string()).default([]),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  inventory: z.record(z.number()).default({}),
  needs: NeedSchema,
  memories: z.array(MemorySchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  knownFacts: z.array(z.string()).default([]),
  lastDecision: z
    .object({
      tick: z.number().int(),
      actionType: z.string(),
      rationale: z.string(),
      source: z.enum(["rules", "llm", "fallback"]),
    })
    .optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const ResourceNodeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  amount: z.number(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  renewable: z.boolean().default(false),
});
export type ResourceNode = z.infer<typeof ResourceNodeSchema>;

export const WorldEventSchema = z.object({
  id: z.string(),
  tick: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["info", "tension", "crisis"]).default("info"),
  locationId: z.string().optional(),
  characterIds: z.array(z.string()).default([]),
  public: z.boolean().default(true),
  processed: z.boolean().default(false),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const SocialRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** When true, trade requires trust >= 10 */
  requireTrustForTrade: z.boolean().default(false),
  /** When true, characters may share cells */
  allowCellSharing: z.boolean().default(false),
  /** When true, inventory may go negative (debt) */
  allowResourceDebt: z.boolean().default(false),
});
export type SocialRule = z.infer<typeof SocialRuleSchema>;

export const WorldSettingsSchema = z.object({
  width: z.number().int().min(4).max(32).default(12),
  height: z.number().int().min(4).max(32).default(12),
  foodScarcity: z.number().min(0).max(1).default(0.4),
  resourceAbundance: z.number().min(0).max(1).default(0.5),
  tickHungerDrain: z.number().min(0).max(10).default(1.5),
  memoryCap: z.number().int().min(4).max(100).default(16),
  maxActionsPerCharacterPerTick: z.number().int().min(1).max(3).default(1),
  socialRules: z.array(SocialRuleSchema).default([]),
});
export type WorldSettings = z.infer<typeof WorldSettingsSchema>;

export const ActionTypeSchema = z.enum([
  "wait",
  "move",
  "gather",
  "eat",
  "talk",
  "trade",
  "work",
  "rest",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionSchema = z.object({
  type: ActionTypeSchema,
  actorId: z.string(),
  targetId: z.string().optional(),
  resourceKind: z.string().optional(),
  amount: z.number().optional(),
  dx: z.number().int().min(-1).max(1).optional(),
  dy: z.number().int().min(-1).max(1).optional(),
  message: z.string().max(280).optional(),
  rationale: z.string().max(500).optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const FeedEntrySchema = z.object({
  id: z.string(),
  tick: z.number().int(),
  text: z.string(),
  severity: z.enum(["info", "tension", "crisis"]).default("info"),
  characterIds: z.array(z.string()).default([]),
});
export type FeedEntry = z.infer<typeof FeedEntrySchema>;

export const MetricsSnapshotSchema = z.object({
  tick: z.number().int(),
  population: z.number().int(),
  totalFood: z.number(),
  totalResources: z.number(),
  allianceCount: z.number().int(),
  conflictEvents: z.number().int(),
  averageHunger: z.number(),
  averageTrust: z.number(),
});
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

export const WorldBlueprintSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  seed: z.number().int(),
  settings: WorldSettingsSchema,
  terrain: z.array(z.array(TerrainTypeSchema)),
  locations: z.array(LocationSchema),
  characters: z.array(CharacterSchema),
  resources: z.array(ResourceNodeSchema),
  events: z.array(WorldEventSchema),
  tensions: z.array(z.string()).default([]),
});
export type WorldBlueprint = z.infer<typeof WorldBlueprintSchema>;

export const WorldStateSchema = WorldBlueprintSchema.extend({
  id: z.string(),
  tick: z.number().int().nonnegative().default(0),
  feed: z.array(FeedEntrySchema).default([]),
  metricsHistory: z.array(MetricsSnapshotSchema).default([]),
  status: z.enum(["ready", "running", "paused", "completed"]).default("ready"),
  parentWorldId: z.string().optional(),
  experimentVariable: z.string().optional(),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

export const ObservationSchema = z.object({
  actorId: z.string(),
  tick: z.number().int(),
  position: Vec2Schema,
  localTerrain: z.array(
    z.object({ x: z.number(), y: z.number(), terrain: TerrainTypeSchema }),
  ),
  nearbyCharacters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      role: z.string(),
    }),
  ),
  nearbyResources: z.array(ResourceNodeSchema),
  nearbyLocations: z.array(LocationSchema),
  needs: NeedSchema,
  inventory: z.record(z.number()),
  goals: z.array(z.string()),
  relevantMemories: z.array(MemorySchema),
  relationships: z.array(RelationshipSchema),
  legalActions: z.array(ActionSchema),
  knownFacts: z.array(z.string()),
  publicEvents: z.array(WorldEventSchema),
});
export type Observation = z.infer<typeof ObservationSchema>;
