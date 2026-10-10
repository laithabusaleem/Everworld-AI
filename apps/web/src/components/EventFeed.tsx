import type { WorldState } from "../api";

export function EventFeed({ world }: { world: WorldState }) {
  const items = [...world.feed].reverse().slice(0, 40);
  return (
    <div className="panel">
      <h3>Event feed</h3>
      {items.length === 0 ? (
        <div className="empty">No events yet. Advance the timeline.</div>
      ) : (
        <div className="feed" aria-live="polite">
          {items.map((item) => (
            <div
              key={item.id}
              className={`feed-item ${item.severity === "tension" || item.severity === "crisis" ? item.severity : ""}`}
            >
              <span className="muted">t{item.tick}</span> {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
