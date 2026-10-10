import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Meta, type WorldSummary } from "../api";

export function HomePage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [m, w] = await Promise.all([api.meta(), api.listWorlds()]);
      setMeta(m);
      setWorlds(w.worlds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function loadExample() {
    setBusy(true);
    try {
      const { world } = await api.createExample(42);
      window.location.href = `/world/${world.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="home-hero">
        <div className="panel hero-copy">
          <span className="badge">
            {!meta
              ? "Connecting…"
              : meta.demoMode
                ? "Demo mode · no API key required"
                : `LLM provider · ${meta.provider}`}
          </span>
          <h1>Everworld AI</h1>
          <p>
            Describe a fictional place. Watch a small society of autonomous
            characters move, bargain, remember, and react — then fork the world
            and compare what changes.
          </p>
          <div className="row" style={{ marginTop: "1rem" }}>
            <Link className="btn" to="/create">
              Create a world
            </Link>
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={() => void loadExample()}
            >
              Load coastal village example
            </button>
          </div>
        </div>
        <div className="panel stack">
          <h2>First run</h2>
          <ol className="muted">
            <li>Load the example or generate from a prompt.</li>
            <li>Preview characters and tensions, then open the world.</li>
            <li>Use Play / Step to advance ticks.</li>
            <li>Run an Experimental Worlds comparison from a saved world.</li>
          </ol>
          <p className="muted" style={{ margin: 0 }}>
            Sample data is labeled in the example world name and description.
            Rule-based decisions power the offline demo.
          </p>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Saved worlds</h2>
          <button className="btn secondary" type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        {worlds.length === 0 ? (
          <div className="empty" style={{ marginTop: "0.75rem" }}>
            No worlds yet. Create one or load the coastal village example.
          </div>
        ) : (
          <div className="world-grid" style={{ marginTop: "0.75rem" }}>
            {worlds.map((w) => (
              <Link key={w.id} className="panel world-card" to={`/world/${w.id}`}>
                <strong>{w.name}</strong>
                <span className="muted">{w.description.slice(0, 140)}</span>
                <span className="badge">
                  seed {w.seed} · {w.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
