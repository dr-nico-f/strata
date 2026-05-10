export interface ContinentView {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
  /**
   * Optional bbox for focus mode (used to dim the rest of the world).
   * Format: [minLng, minLat, maxLng, maxLat]. Omit for "World" (no dimming).
   */
  bbox?: [number, number, number, number];
}

export const CONTINENT_VIEWS: readonly ContinentView[] = [
  { id: "world", label: "World", center: [20, 30], zoom: 1.6 },
  {
    id: "europe",
    label: "Europe",
    center: [15, 50],
    zoom: 3.4,
    bbox: [-12, 34, 45, 71],
  },
  {
    id: "asia",
    label: "Asia",
    center: [95, 35],
    zoom: 2.4,
    bbox: [40, -10, 150, 75],
  },
  {
    id: "africa",
    label: "Africa",
    center: [20, 5],
    zoom: 2.4,
    bbox: [-20, -36, 55, 38],
  },
  {
    id: "americas",
    label: "Americas",
    center: [-80, 10],
    zoom: 2.0,
    bbox: [-170, -56, -32, 75],
  },
  {
    id: "oceania",
    label: "Oceania",
    center: [145, -20],
    zoom: 2.6,
    bbox: [105, -50, 180, 5],
  },
];
