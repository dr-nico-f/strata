/**
 * Given a list of snapshot years (sorted ascending) and a target year,
 * return the snapshot year with the largest value <= target. If no such
 * snapshot exists (target is before the first snapshot), return the first.
 */
export function pickSnapshotYear(
  snapshotYears: readonly number[],
  targetYear: number,
): number {
  if (snapshotYears.length === 0) {
    throw new Error("pickSnapshotYear called with empty snapshot list");
  }

  let result = snapshotYears[0];
  for (const y of snapshotYears) {
    if (y <= targetYear) {
      result = y;
    } else {
      break;
    }
  }
  return result;
}
