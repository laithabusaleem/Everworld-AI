import type { Character, WorldState } from "../api";

type Props = {
  world: WorldState;
  character: Character | null;
};

function Meter({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: string;
}) {
  return (
    <div className="field">
      <label>
        {label}: {value.toFixed(0)}
      </label>
      <div className={`meter ${kind}`} aria-hidden>
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function CharacterInspector({ world, character }: Props) {
  if (!character) {
    return (
      <div className="panel">
        <h3>Character inspector</h3>
        <div className="empty">
          Select a character on the map to inspect public knowledge,
          motivations, and the latest decision.
        </div>
      </div>
    );
  }

  const nameById = new Map(world.characters.map((c) => [c.id, c.name]));

  return (
    <div className="panel stack">
      <div>
        <h3>{character.name}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {character.role} · ({character.x}, {character.y})
        </p>
      </div>

      <div className="row">
        {character.traits.map((t) => (
          <span className="badge" key={t}>
            {t}
          </span>
        ))}
      </div>

      <div>
        <strong>Goals</strong>
        <ul>
          {character.goals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>

      <Meter label="Hunger" value={character.needs.hunger} kind="hunger" />
      <Meter label="Energy" value={character.needs.energy} kind="energy" />
      <Meter label="Social" value={character.needs.social} kind="social" />

      <div>
        <strong>Inventory</strong>
        <p className="muted" style={{ margin: "0.25rem 0 0" }}>
          {Object.entries(character.inventory)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ") || "Empty"}
        </p>
      </div>

      <div>
        <strong>Latest decision</strong>
        {character.lastDecision ? (
          <p style={{ margin: "0.35rem 0 0" }}>
            Tick {character.lastDecision.tick}:{" "}
            <em>{character.lastDecision.actionType}</em> —{" "}
            {character.lastDecision.rationale}{" "}
            <span className="badge">{character.lastDecision.source}</span>
          </p>
        ) : (
          <p className="muted">No decision yet.</p>
        )}
      </div>

      <div>
        <strong>Public knowledge / known facts</strong>
        <ul>
          {character.knownFacts
            .filter((f) => !f.startsWith("private:"))
            .map((f) => (
              <li key={f}>{f}</li>
            ))}
        </ul>
        <p className="muted" style={{ fontSize: "0.75rem" }}>
          Private memories are hidden from other characters and from this public
          inspector summary when marked private.
        </p>
      </div>

      <div>
        <strong>Memories</strong>
        <ul>
          {character.memories
            .filter((m) => !m.private)
            .slice(-6)
            .map((m) => (
              <li key={m.id}>
                [t{m.tick}] {m.text}
              </li>
            ))}
        </ul>
      </div>

      <div>
        <strong>Relationships</strong>
        <ul>
          {character.relationships.map((r) => (
            <li key={r.targetId}>
              {nameById.get(r.targetId) ?? r.targetId}: trust {r.trust},
              familiarity {r.familiarity}, conflict {r.conflict}
              {r.alliance ? " · alliance" : ""}
              {r.notes ? ` — ${r.notes}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
