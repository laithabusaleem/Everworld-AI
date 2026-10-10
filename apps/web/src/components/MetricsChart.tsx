type Point = { tick: number; value: number };

type Props = {
  title: string;
  series: Array<{ label: string; color: string; points: Point[] }>;
};

export function MetricsChart({ title, series }: Props) {
  const width = 520;
  const height = 180;
  const pad = 24;
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return (
      <div className="panel">
        <h3>{title}</h3>
        <div className="empty">No metric samples yet.</div>
      </div>
    );
  }
  const minX = Math.min(...all.map((p) => p.tick));
  const maxX = Math.max(...all.map((p) => p.tick));
  const minY = Math.min(...all.map((p) => p.value));
  const maxY = Math.max(...all.map((p) => p.value));
  const dx = Math.max(1, maxX - minX);
  const dy = Math.max(1e-6, maxY - minY);

  const pathFor = (points: Point[]) =>
    points
      .map((p, i) => {
        const x = pad + ((p.tick - minX) / dx) * (width - pad * 2);
        const y =
          height - pad - ((p.value - minY) / dy) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="panel">
      <h3>{title}</h3>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
      >
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="#2f5a6e"
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          stroke="#2f5a6e"
        />
        {series.map((s) => (
          <path
            key={s.label}
            d={pathFor(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="row">
        {series.map((s) => (
          <span className="badge" key={s.label} style={{ borderColor: s.color }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
