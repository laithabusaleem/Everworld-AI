import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type WorldState } from "../api";
import { CharacterInspector } from "../components/CharacterInspector";
import { EventFeed } from "../components/EventFeed";
import { WorldMap } from "../components/WorldMap";

export function WorldPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tickMs, setTickMs] = useState(700);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { world: w } = await api.getWorld(id);
    setWorld(w);
    setError(null);
  }, [id]);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Load failed"),
    );
  }, [refresh]);

  useEffect(() => {
    if (!playing) return;
    const handle = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, Math.max(250, tickMs));
    return () => window.clearInterval(handle);
  }, [playing, tickMs, refresh]);

  const selected = useMemo(
    () => world?.characters.find((c) => c.id === selectedId) ?? null,
    [world, selectedId],
  );

  async function step() {
    setBusy(true);
    try {
      const { world: w } = await api.tick(id, 1);
      setWorld(w);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tick failed");
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    setBusy(true);
    try {
      await api.play(id, tickMs);
      setPlaying(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Play failed");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    setBusy(true);
    try {
      const { world: w } = await api.pause(id);
      setWorld(w);
      setPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await api.pause(id).catch(() => undefined);
      const { world: w } = await api.reset(id);
      setWorld(w);
      setPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api.snapshot(id, `manual-t${world?.tick ?? 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!world && !error) {
    return <div className="panel">Loading world…</div>;
  }

  if (!world) {
    return (
      <div className="stack">
        <div className="error">{error}</div>
        <Link className="btn secondary" to="/">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <Link className="btn secondary" to="/">
            ← Home
          </Link>
          <button
            className="btn ember"
            type="button"
            onClick={() => navigate(`/world/${id}/experiment`)}
          >
            Experimental worlds
          </button>
        </div>
        <span className="badge">
          tick {world.tick} · seed {world.seed} · {world.status}
        </span>
      </div>

      <header className="panel">
        <h2 style={{ marginTop: 0 }}>{world.name}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          {world.description}
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="panel row">
        <button className="btn" type="button" disabled={busy || playing} onClick={() => void play()}>
          Play
        </button>
        <button className="btn secondary" type="button" disabled={busy || !playing} onClick={() => void pause()}>
          Pause
        </button>
        <button className="btn secondary" type="button" disabled={busy || playing} onClick={() => void step()}>
          Step one tick
        </button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => void reset()}>
          Reset
        </button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => void save()}>
          Save snapshot
        </button>
        <label className="muted" htmlFor="speed">
          Tick speed (ms)
        </label>
        <input
          id="speed"
          style={{ width: 100 }}
          type="number"
          min={150}
          max={3000}
          step={50}
          value={tickMs}
          onChange={(e) => setTickMs(Number(e.target.value))}
        />
      </div>

      <div className="sim-layout">
        <div className="stack">
          <div className="panel stack">
            <h3>World map</h3>
            <WorldMap
              world={world}
              selectedId={selectedId}
              onSelectCharacter={setSelectedId}
            />
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Letters are characters. ◇ marks named locations. Click a character
              to inspect.
            </p>
          </div>
          <EventFeed world={world} />
          <div className="panel">
            <h3>Social tensions</h3>
            <ul>
              {world.tensions.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="side-stack">
          <CharacterInspector world={world} character={selected} />
          <div className="panel">
            <h3>Cast</h3>
            <div className="stack">
              {world.characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn secondary"
                  style={{ textAlign: "left" }}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.name} — {c.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
