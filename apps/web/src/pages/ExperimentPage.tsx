import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ExperimentResult, type WorldState } from "../api";
import { MetricsChart } from "../components/MetricsChart";

export function ExperimentPage() {
  const { id = "" } = useParams();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [variable, setVariable] = useState("foodScarcity");
  const [value, setValue] = useState("0.9");
  const [ticks, setTicks] = useState("40");
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .getWorld(id)
      .then((r) => setWorld(r.world))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Load failed"),
      );
  }, [id]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const parsedValue =
        variable === "requireTrustForTrade"
          ? value === "true" || value === "1"
          : Number(value);
      const { experiment } = await api.runExperiment({
        sourceWorldId: id,
        variable,
        value: parsedValue,
        ticks: Number(ticks) || 40,
        seed: world?.seed,
        name: `${world?.name ?? "World"} · ${variable}`,
      });
      setResult(experiment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Experiment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Link className="btn secondary" to={`/world/${id}`}>
          ← Back to world
        </Link>
      </div>

      <section className="panel stack">
        <h2>Experimental worlds</h2>
        <p className="muted" style={{ margin: 0 }}>
          Fork the current world into control and treatment branches from an
          equivalent initial snapshot. Modify one variable, simulate both, and
          compare real metrics. The original world is not mutated.
        </p>
        {world && (
          <p>
            Source: <strong>{world.name}</strong> (seed {world.seed})
          </p>
        )}
        <div className="row">
          <div className="field">
            <label htmlFor="variable">Variable</label>
            <select
              id="variable"
              value={variable}
              onChange={(e) => {
                setVariable(e.target.value);
                if (e.target.value === "requireTrustForTrade") setValue("true");
                else setValue("0.9");
              }}
            >
              <option value="foodScarcity">foodScarcity</option>
              <option value="resourceAbundance">resourceAbundance</option>
              <option value="requireTrustForTrade">requireTrustForTrade</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="value">Treatment value</label>
            <input
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ticks">Ticks</label>
            <input
              id="ticks"
              value={ticks}
              onChange={(e) => setTicks(e.target.value)}
            />
          </div>
          <button className="btn" type="button" disabled={busy} onClick={() => void run()}>
            {busy ? "Running…" : "Run comparison"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      {result && (
        <>
          <section className="panel stack">
            <h3>{result.name}</h3>
            <p className="muted">
              Seed {result.seed} · {result.ticks} ticks · treatment{" "}
              {result.variable}={String(result.value)}
            </p>
            <ul>
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className="row">
              <Link className="btn secondary" to={`/world/${result.control.worldId}`}>
                Open control world
              </Link>
              <Link
                className="btn secondary"
                to={`/world/${result.treatment.worldId}`}
              >
                Open treatment world
              </Link>
            </div>
          </section>

          <MetricsChart
            title="Total food over time"
            series={[
              {
                label: "Control",
                color: "#8fd6c4",
                points: result.control.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.totalFood,
                })),
              },
              {
                label: "Treatment",
                color: "#e07a3a",
                points: result.treatment.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.totalFood,
                })),
              },
            ]}
          />
          <MetricsChart
            title="Average hunger"
            series={[
              {
                label: "Control",
                color: "#8fd6c4",
                points: result.control.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.averageHunger,
                })),
              },
              {
                label: "Treatment",
                color: "#e07a3a",
                points: result.treatment.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.averageHunger,
                })),
              },
            ]}
          />
          <MetricsChart
            title="Alliances"
            series={[
              {
                label: "Control",
                color: "#8fd6c4",
                points: result.control.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.allianceCount,
                })),
              },
              {
                label: "Treatment",
                color: "#e07a3a",
                points: result.treatment.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.allianceCount,
                })),
              },
            ]}
          />
          <MetricsChart
            title="Conflict signal"
            series={[
              {
                label: "Control",
                color: "#8fd6c4",
                points: result.control.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.conflictEvents,
                })),
              },
              {
                label: "Treatment",
                color: "#e07a3a",
                points: result.treatment.metrics.map((m) => ({
                  tick: m.tick,
                  value: m.conflictEvents,
                })),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
