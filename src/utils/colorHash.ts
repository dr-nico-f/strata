/**
 * Deterministically derive a hue from a string so each named entity
 * gets a stable, distinct color across snapshots.
 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function colorFromName(name: string): string {
  if (!name) return "#888";
  const h = hashString(name) % 360;
  const s = 55 + (hashString(name + "s") % 25);
  const l = 50 + (hashString(name + "l") % 15);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
