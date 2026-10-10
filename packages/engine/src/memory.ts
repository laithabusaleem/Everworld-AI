import type { Character, Memory, WorldState } from "./schemas.js";

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function addMemory(
  character: Character,
  memory: Omit<Memory, "id" | "private" | "importance" | "subjects"> & {
    id?: string;
    private?: boolean;
    importance?: number;
    subjects?: string[];
  },
  memoryCap: number,
): Character {
  const textKey = normalizeText(memory.text);
  const duplicate = character.memories.some(
    (m) => normalizeText(m.text) === textKey,
  );
  if (duplicate) {
    return character;
  }

  const next: Memory = {
    id: memory.id ?? `mem_${character.id}_${memory.tick}_${character.memories.length}`,
    tick: memory.tick,
    kind: memory.kind,
    text: memory.text,
    importance: memory.importance ?? 0.5,
    subjects: memory.subjects ?? [],
    private: memory.private ?? false,
  };

  let memories = [...character.memories, next];
  if (memories.length > memoryCap) {
    memories = summarizeOldMemories(memories, memoryCap, character.id);
  }
  return { ...character, memories };
}

/** Collapse oldest low-importance episodic memories into one semantic summary. */
export function summarizeOldMemories(
  memories: Memory[],
  cap: number,
  characterId: string,
): Memory[] {
  if (memories.length <= cap) return memories;

  const sorted = [...memories].sort((a, b) => a.tick - b.tick);
  const keepCount = Math.max(4, cap - 1);
  const dropCount = sorted.length - keepCount;
  const toSummarize = sorted.slice(0, dropCount);
  const keep = sorted.slice(dropCount);

  const subjects = [...new Set(toSummarize.flatMap((m) => m.subjects))];
  const summary: Memory = {
    id: `mem_sum_${characterId}_${toSummarize[0]?.tick ?? 0}`,
    tick: toSummarize[toSummarize.length - 1]?.tick ?? 0,
    kind: "semantic",
    text: `Earlier experiences (${toSummarize.length}): ${toSummarize
      .map((m) => m.text)
      .slice(0, 4)
      .join("; ")}${toSummarize.length > 4 ? "…" : ""}`,
    importance: Math.min(
      1,
      toSummarize.reduce((s, m) => s + m.importance, 0) / toSummarize.length,
    ),
    subjects,
    private: toSummarize.some((m) => m.private),
  };

  return [...keep, summary].sort((a, b) => a.tick - b.tick);
}

export function retrieveRelevantMemories(
  character: Character,
  subjects: string[],
  limit = 5,
): Memory[] {
  const subjectSet = new Set(subjects.map((s) => s.toLowerCase()));
  const scored = character.memories.map((m) => {
    const overlap = m.subjects.filter((s) =>
      subjectSet.has(s.toLowerCase()),
    ).length;
    const score = overlap * 2 + m.importance + m.tick * 0.0001;
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.m);
}

export function updateRelationship(
  state: WorldState,
  actorId: string,
  targetId: string,
  delta: Partial<{
    trust: number;
    familiarity: number;
    conflict: number;
    alliance: boolean;
    notes: string;
  }>,
): WorldState {
  const characters = state.characters.map((c) => {
    if (c.id !== actorId) return c;
    const existing = c.relationships.find((r) => r.targetId === targetId);
    const base = existing ?? {
      targetId,
      trust: 0,
      familiarity: 0,
      conflict: 0,
      alliance: false,
      notes: "",
    };
    const next = {
      ...base,
      trust: clamp(base.trust + (delta.trust ?? 0), -100, 100),
      familiarity: clamp(
        base.familiarity + (delta.familiarity ?? 0),
        0,
        100,
      ),
      conflict: clamp(base.conflict + (delta.conflict ?? 0), 0, 100),
      alliance: delta.alliance ?? base.alliance,
      notes: delta.notes ?? base.notes,
    };
    const relationships = existing
      ? c.relationships.map((r) => (r.targetId === targetId ? next : r))
      : [...c.relationships, next];
    return { ...c, relationships };
  });
  return { ...state, characters };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
