import type { WorldState } from "../api";

const TERRAIN_COLOR: Record<string, string> = {
  water: "#1f5f8b",
  sand: "#c9a66b",
  grass: "#3f7a4a",
  path: "#8a7355",
  building: "#5a4a3a",
  rock: "#6a7278",
  forest: "#245536",
};

const TERRAIN_GLYPH: Record<string, string> = {
  water: "~",
  sand: ".",
  grass: ",",
  path: "=",
  building: "#",
  rock: "^",
  forest: "T",
};

type Props = {
  world: WorldState;
  selectedId?: string | null;
  onSelectCharacter?: (id: string) => void;
};

export function WorldMap({ world, selectedId, onSelectCharacter }: Props) {
  const charAt = new Map<string, (typeof world.characters)[number]>(
    world.characters.map((c) => [`${c.x},${c.y}`, c]),
  );
  const locAt = new Map<string, (typeof world.locations)[number]>(
    world.locations.map((l) => [`${l.x},${l.y}`, l]),
  );

  return (
    <div
      className="map"
      role="grid"
      aria-label={`World map ${world.settings.width} by ${world.settings.height}`}
      style={{
        gridTemplateColumns: `repeat(${world.settings.width}, 28px)`,
      }}
    >
      {world.terrain.map((row, y) =>
        row.map((terrain, x) => {
          const key = `${x},${y}`;
          const character = charAt.get(key);
          const location = locAt.get(key);
          const selected = character && character.id === selectedId;
          return (
            <div
              key={key}
              role="gridcell"
              className={`map-cell${character ? " clickable" : ""}`}
              title={
                character
                  ? `${character.name} (${character.role})`
                  : location
                    ? location.name
                    : terrain
              }
              style={{
                background: TERRAIN_COLOR[terrain] ?? "#333",
                outline: selected ? "2px solid #e2c48a" : undefined,
              }}
              onClick={() => {
                if (character && onSelectCharacter) {
                  onSelectCharacter(character.id);
                }
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  character &&
                  onSelectCharacter
                ) {
                  e.preventDefault();
                  onSelectCharacter(character.id);
                }
              }}
              tabIndex={character ? 0 : -1}
            >
              <span className="glyph">
                {character
                  ? character.name.slice(0, 1)
                  : location
                    ? "◇"
                    : (TERRAIN_GLYPH[terrain] ?? "?")}
              </span>
            </div>
          );
        }),
      )}
    </div>
  );
}
