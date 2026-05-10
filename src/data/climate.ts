/**
 * Global temperature anomaly anchors over time, in degrees Celsius relative
 * to the 1850-1900 pre-industrial baseline. Values are synthesised from
 * common climate reconstructions:
 *   - Marcott et al. (2013) Holocene composite
 *   - PAGES 2k Consortium (2013, 2019)
 *   - Kaufman et al. (2020) Holocene global temperature
 *   - HadCRUT5 + Berkeley Earth instrumental (1850–present)
 *   - Shakun et al. (2012) global LGM-to-Holocene reconstruction
 *
 * Anchors are dense enough to capture well-documented excursions: the
 * Younger Dryas, the 8.2 ka event, the Holocene Climatic Optimum, the
 * 4.2 ka event, the Roman Warm Period, the Late Antique Little Ice Age
 * (536-660 CE), the Medieval Warm Period, the Spörer/Maunder/Dalton
 * minima of the Little Ice Age, and modern industrial warming.
 *
 * These remain BEST-EFFORT illustrative values, not authoritative
 * reconstructions.
 */

export interface ClimateAnchor {
  year: number;
  /** Anomaly in °C relative to 1850-1900 baseline. */
  anomaly: number;
  /** Optional epoch label - not all anchors carry one. */
  epoch?: string;
}

export const CLIMATE: readonly ClimateAnchor[] = [
  // -------- Late Pleistocene & deglaciation --------
  { year: -10000, anomaly: -4.5, epoch: "Last Glacial Maximum tail" },
  { year: -9700, anomaly: -3.8, epoch: "Bølling–Allerød warm" },
  { year: -9100, anomaly: -3.0, epoch: "Bølling–Allerød warm" },
  { year: -8800, anomaly: -3.6, epoch: "Younger Dryas" },
  { year: -8200, anomaly: -2.8, epoch: "Early Holocene warming" },

  // -------- Holocene Climatic Optimum & 8.2 ka event --------
  { year: -7700, anomaly: -1.4 },
  { year: -7000, anomaly: -0.6 },
  { year: -6200, anomaly: -1.0, epoch: "8.2 ka event (cooling pulse)" },
  { year: -6000, anomaly: 0.4, epoch: "Holocene Climatic Optimum" },
  { year: -5500, anomaly: 0.6, epoch: "Holocene Climatic Optimum" },
  { year: -5000, anomaly: 0.7, epoch: "Holocene Climatic Optimum peak" },
  { year: -4500, anomaly: 0.6 },
  { year: -4000, anomaly: 0.4, epoch: "Late Holocene Optimum" },

  // -------- Bronze Age & 4.2 ka event --------
  { year: -3000, anomaly: 0.2 },
  { year: -2500, anomaly: 0.0 },
  { year: -2200, anomaly: -0.3, epoch: "4.2 ka event drying / cool" },
  { year: -2000, anomaly: -0.1, epoch: "Bronze Age stable" },
  { year: -1500, anomaly: 0.0, epoch: "Late Bronze Age" },
  { year: -1200, anomaly: -0.4, epoch: "Bronze Age Collapse cool" },

  // -------- Iron Age, Greek/Roman classical --------
  { year: -900, anomaly: -0.2, epoch: "Greek Dark Ages cool" },
  { year: -500, anomaly: -0.1, epoch: "Iron Age" },
  { year: -200, anomaly: 0.0 },
  { year: 0, anomaly: 0.1, epoch: "Roman Warm Period" },
  { year: 150, anomaly: 0.25, epoch: "Roman Warm Period peak" },
  { year: 300, anomaly: 0.0 },

  // -------- Migration period & Late Antique cooling --------
  { year: 450, anomaly: -0.3, epoch: "Migration period cool" },
  { year: 540, anomaly: -0.7, epoch: "Late Antique Little Ice Age" },
  { year: 600, anomaly: -0.6, epoch: "Late Antique Little Ice Age" },
  { year: 700, anomaly: -0.3 },
  { year: 800, anomaly: -0.1, epoch: "Carolingian climate" },

  // -------- Medieval Warm Period --------
  { year: 950, anomaly: 0.1, epoch: "Medieval Warm Period" },
  { year: 1050, anomaly: 0.25, epoch: "Medieval Warm Period peak" },
  { year: 1150, anomaly: 0.2, epoch: "Medieval Warm Period" },
  { year: 1250, anomaly: 0.05 },

  // -------- Little Ice Age (Wolf / Spörer / Maunder / Dalton) --------
  { year: 1320, anomaly: -0.2, epoch: "LIA onset (Wolf Minimum)" },
  { year: 1450, anomaly: -0.5, epoch: "Spörer Minimum" },
  { year: 1550, anomaly: -0.6, epoch: "Little Ice Age" },
  { year: 1650, anomaly: -0.75, epoch: "Maunder Minimum" },
  { year: 1700, anomaly: -0.7, epoch: "Maunder Minimum tail" },
  { year: 1800, anomaly: -0.55, epoch: "Dalton Minimum" },
  { year: 1815, anomaly: -0.85, epoch: "Tambora 'Year w/o Summer'" },
  { year: 1830, anomaly: -0.5 },

  // -------- Industrial & modern --------
  { year: 1880, anomaly: -0.16 },
  { year: 1900, anomaly: -0.08 },
  { year: 1920, anomaly: -0.27 },
  { year: 1940, anomaly: -0.02 },
  { year: 1960, anomaly: -0.03 },
  { year: 1980, anomaly: 0.27 },
  { year: 2000, anomaly: 0.62 },
  { year: 2010, anomaly: 0.83 },
  { year: 2016, anomaly: 1.16, epoch: "Strong El Niño" },
  { year: 2020, anomaly: 1.18 },
  { year: 2023, anomaly: 1.48, epoch: "Modern warming" },
  { year: 2025, anomaly: 1.5, epoch: "Modern warming" },
];

export function climateAt(year: number): { anomaly: number; epoch?: string } {
  if (year <= CLIMATE[0].year) {
    return { anomaly: CLIMATE[0].anomaly, epoch: CLIMATE[0].epoch };
  }
  if (year >= CLIMATE[CLIMATE.length - 1].year) {
    const last = CLIMATE[CLIMATE.length - 1];
    return { anomaly: last.anomaly, epoch: last.epoch };
  }
  for (let i = 1; i < CLIMATE.length; i += 1) {
    const a = CLIMATE[i - 1];
    const b = CLIMATE[i];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      const anomaly = a.anomaly + (b.anomaly - a.anomaly) * t;
      const epoch = t < 0.5 ? a.epoch ?? b.epoch : b.epoch ?? a.epoch;
      return { anomaly, epoch };
    }
  }
  return { anomaly: 0 };
}

/**
 * Map an anomaly to a soft hex/rgb color: cool blue → neutral gray → warm red.
 * Wider clamp range now (-5 to +3) to accommodate Younger Dryas-style depth
 * and continued modern warming.
 */
export function climateColor(anomaly: number): string {
  const a = Math.max(-5, Math.min(3, anomaly));
  if (a < 0) {
    const t = a / -5;
    const r = Math.round(140 - t * 70);
    const g = Math.round(180 - t * 90);
    const b = Math.round(220 - t * 30);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = a / 3;
  const r = Math.round(180 + t * 70);
  const g = Math.round(140 - t * 90);
  const b = Math.round(120 - t * 100);
  return `rgb(${r}, ${g}, ${b})`;
}
