export interface Era {
  id: string;
  label: string;
  year: number;
}

export const ERAS: readonly Era[] = [
  { id: "ice-age", label: "Last Glacial Max", year: -10000 },
  { id: "neolithic", label: "Neolithic", year: -6000 },
  { id: "early-bronze", label: "Early Bronze", year: -3000 },
  { id: "bronze", label: "Bronze Age", year: -2000 },
  { id: "iron", label: "Iron Age", year: -800 },
  { id: "classical", label: "Classical", year: -400 },
  { id: "roman", label: "Roman Empire", year: 100 },
  { id: "early-medieval", label: "Early Medieval", year: 700 },
  { id: "high-medieval", label: "High Medieval", year: 1200 },
  { id: "renaissance", label: "Renaissance", year: 1500 },
  { id: "exploration", label: "Age of Exploration", year: 1600 },
  { id: "enlightenment", label: "Enlightenment", year: 1750 },
  { id: "industrial", label: "Industrial", year: 1850 },
  { id: "ww1", label: "WWI", year: 1914 },
  { id: "ww2", label: "WWII", year: 1942 },
  { id: "modern", label: "Modern", year: 2010 },
] as const;
