import { climateAt, climateColor } from "../data/climate";
import { useStore } from "../store";

/**
 * Top-of-screen color band that shifts with the current global temperature
 * anomaly. The numeric readout that used to live in the corner moved into
 * the Header (App.tsx) so it can sit next to the wordmark without fighting
 * the LayerToggles panel for top-right real estate, and so it isn't
 * dimmed by this band's translucency.
 *
 * Hidden in print mode (hideUi).
 */
export function ClimateBand() {
  const year = useStore((s) => s.year);
  const hideUi = useStore((s) => s.hideUi);
  if (hideUi) return null;

  const c = climateAt(year);
  const color = climateColor(c.anomaly);

  return (
    <div
      aria-hidden
      title="Global temperature anomaly relative to ~1850 baseline"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: color,
        opacity: 0.55,
        zIndex: 80,
        pointerEvents: "none",
        boxShadow: `0 0 18px 2px ${color}`,
      }}
    />
  );
}
