import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Blueprint } from "../api";

const SAMPLE =
  "A coastal village with scarce food, two rival merchant families, an abandoned lighthouse, and a festival in three days.";

export function CreatePage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState(SAMPLE);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("42");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.generate({
        description,
        seed: Number(seed) || undefined,
        name: name || undefined,
        previewOnly: true,
      });
      if (!res.blueprint) throw new Error("No blueprint returned");
      setBlueprint(res.blueprint);
      setProvider(res.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!blueprint) {
      await preview();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { world } = await api.fromBlueprint(blueprint);
      navigate(`/world/${world.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Link className="btn secondary" to="/">
          ← Home
        </Link>
      </div>

      <section className="panel stack">
        <h2>Generate a world</h2>
        <p className="muted" style={{ margin: 0 }}>
          Rule-based generation works offline. If an OpenAI-compatible API key
          is configured on the server, generation may use the LLM and fall back
          to rules on failure.
        </p>
        <div className="field">
          <label htmlFor="desc">World description</label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="name">Name (optional)</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Harbor of Twin Sails"
            />
          </div>
          <div className="field" style={{ width: 140 }}>
            <label htmlFor="seed">Seed</label>
            <input
              id="seed"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <button className="btn secondary" type="button" disabled={busy} onClick={() => void preview()}>
            Preview
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => void create()}>
            {blueprint ? "Create world" : "Preview & create"}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => setDescription(SAMPLE)}
          >
            Use sample prompt
          </button>
        </div>
        {provider && (
          <p className="muted">
            Generator: <span className="badge">{provider}</span>
          </p>
        )}
        {error && <div className="error">{error}</div>}
      </section>

      {blueprint && (
        <section className="panel stack">
          <h2>Preview & edit</h2>
          <div className="field">
            <label htmlFor="bp-name">World name</label>
            <input
              id="bp-name"
              value={blueprint.name}
              onChange={(e) =>
                setBlueprint({ ...blueprint, name: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="bp-desc">Description</label>
            <textarea
              id="bp-desc"
              value={blueprint.description}
              onChange={(e) =>
                setBlueprint({ ...blueprint, description: e.target.value })
              }
            />
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="scarcity">Food scarcity (0–1)</label>
              <input
                id="scarcity"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={blueprint.settings.foodScarcity}
                onChange={(e) =>
                  setBlueprint({
                    ...blueprint,
                    settings: {
                      ...blueprint.settings,
                      foodScarcity: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="abundance">Resource abundance (0–1)</label>
              <input
                id="abundance"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={blueprint.settings.resourceAbundance}
                onChange={(e) =>
                  setBlueprint({
                    ...blueprint,
                    settings: {
                      ...blueprint.settings,
                      resourceAbundance: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          <h3>Characters</h3>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {blueprint.characters.map((c, idx) => (
                <tr key={c.id}>
                  <td>
                    <input
                      value={c.name}
                      aria-label={`Character ${idx + 1} name`}
                      onChange={(e) => {
                        const characters = blueprint.characters.map((ch, i) =>
                          i === idx ? { ...ch, name: e.target.value } : ch,
                        );
                        setBlueprint({ ...blueprint, characters });
                      }}
                    />
                  </td>
                  <td>{c.role}</td>
                  <td>{c.goals.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Tensions</h3>
          <ul>
            {blueprint.tensions.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
