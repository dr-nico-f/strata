import { BATTLES } from "../data/battles";
import { DISASTERS } from "../data/disasters";
import { EVENTS } from "../data/events";
import { MAX_YEAR, MIN_YEAR } from "../store";

const BIN_SIZE = 200; // years per density bucket

/**
 * Bin all dated point-events (events, battles, disasters) into 200-year
 * windows from MIN_YEAR..MAX_YEAR. Returns counts and the corresponding
 * bin start years. Memoised at module scope.
 */
function build(): { bins: number[]; starts: number[]; max: number } {
  const count = Math.ceil((MAX_YEAR - MIN_YEAR) / BIN_SIZE) + 1;
  const bins = new Array<number>(count).fill(0);
  const starts = new Array<number>(count);
  for (let i = 0; i < count; i += 1) starts[i] = MIN_YEAR + i * BIN_SIZE;

  const bump = (year: number) => {
    const idx = Math.floor((year - MIN_YEAR) / BIN_SIZE);
    if (idx >= 0 && idx < count) bins[idx] += 1;
  };

  for (const e of EVENTS) bump(e.year);
  for (const b of BATTLES) bump(b.year);
  for (const d of DISASTERS) bump(d.year);

  let max = 0;
  for (const v of bins) if (v > max) max = v;

  return { bins, starts, max: Math.max(max, 1) };
}

export const DENSITY = build();
export const DENSITY_BIN_SIZE = BIN_SIZE;
