import { useMemo } from "react";
import { CITIES, cityPopulationAt, type City } from "../data/cities";
import { MAX_YEAR } from "../store";

const W = 220;
const H = 44;
const PAD_X = 6;
const PAD_Y = 6;

/**
 * Look up a city by id from the merged dataset. Linear scan is cheap enough
 * because pinned tooltips are rare and the dataset is ~1500 entries.
 */
function findCity(id: string | undefined): City | undefined {
  if (!id) return undefined;
  return CITIES.find((c) => c.id === id);
}

/**
 * Inline SVG sparkline of a city's population trajectory across its lifetime.
 * Returns null when the city has no `populationCurve` (most GeoNames-derived
 * modern cities) — they get a "no historical data" placeholder instead.
 */
export function CityPopulationSparkline({
  cityId,
  year,
}: {
  cityId: string | undefined;
  year: number;
}) {
  const city = useMemo(() => findCity(cityId), [cityId]);

  const sample = useMemo(() => {
    if (!city || !city.populationCurve || city.populationCurve.length < 2) {
      return null;
    }
    const start = city.founded;
    const end = city.abandoned ?? MAX_YEAR;
    if (end <= start) return null;
    const N = 64;
    const points: Array<{ year: number; pop: number }> = [];
    for (let i = 0; i < N; i += 1) {
      const yr = start + (i / (N - 1)) * (end - start);
      points.push({ year: yr, pop: cityPopulationAt(city, yr) });
    }
    const maxPop = Math.max(...points.map((p) => p.pop), 1);
    const minPop = 0;
    return { points, start, end, maxPop, minPop };
  }, [city]);

  if (!city) return null;

  if (!sample) {
    return (
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-muted)",
          fontStyle: "italic",
        }}
      >
        No population history on file.
      </div>
    );
  }

  const { points, start, end, maxPop } = sample;
  const xFor = (yr: number) =>
    PAD_X + ((yr - start) / (end - start)) * (W - PAD_X * 2);
  const yFor = (pop: number) => {
    const t = pop / maxPop;
    return H - PAD_Y - t * (H - PAD_Y * 2);
  };

  // Build the area + line path
  const linePath = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${xFor(p.year).toFixed(1)},${yFor(p.pop).toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${xFor(end).toFixed(1)},${(H - PAD_Y).toFixed(1)} L${xFor(start).toFixed(1)},${(H - PAD_Y).toFixed(1)} Z`;

  // Current-year marker. Clamp to the city's lifetime so the line stays in.
  const clampedYear = Math.max(start, Math.min(end, year));
  const popNow = cityPopulationAt(city, clampedYear);
  const cx = xFor(clampedYear);
  const cy = yFor(popNow);
  const inLifetime = year >= start && year <= end;

  // Pretty label for current population (thousands → readable).
  const label =
    popNow >= 1000
      ? `${(popNow / 1000).toFixed(1)}M`
      : popNow >= 1
        ? `${Math.round(popNow)}k`
        : popNow > 0
          ? `<1k`
          : "—";

  // Peak label for context.
  const peak = points.reduce(
    (acc, p) => (p.pop > acc.pop ? p : acc),
    points[0],
  );
  const peakLabel =
    peak.pop >= 1000
      ? `${(peak.pop / 1000).toFixed(1)}M`
      : `${Math.round(peak.pop)}k`;

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 2,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Population
        </div>
        <div
          style={{
            fontSize: 11,
            color: inLifetime ? "var(--accent-strong)" : "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {inLifetime ? label : "off-screen"}
        </div>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", borderRadius: 4 }}
      >
        <defs>
          <linearGradient id="hs-pop-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(95, 209, 160, 0.55)" />
            <stop offset="100%" stopColor="rgba(95, 209, 160, 0.05)" />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="rgba(255,255,255,0.03)"
          rx={4}
        />
        <path d={areaPath} fill="url(#hs-pop-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(95, 209, 160, 0.95)"
          strokeWidth={1.4}
        />
        {inLifetime && (
          <>
            <line
              x1={cx}
              x2={cx}
              y1={PAD_Y}
              y2={H - PAD_Y}
              stroke="var(--accent-strong)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={cx}
              cy={cy}
              r={3.5}
              fill="var(--accent-strong)"
              stroke="#0c1018"
              strokeWidth={1}
            />
          </>
        )}
      </svg>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 2,
          display: "flex",
          justifyContent: "space-between",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>peak {peakLabel} · {Math.round(peak.year)}</span>
        <span>
          {Math.round(start)} → {Math.round(end)}
        </span>
      </div>
    </div>
  );
}
