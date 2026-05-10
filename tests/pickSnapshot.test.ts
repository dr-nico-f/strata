import { describe, it, expect } from "vitest";
import { pickSnapshotYear } from "../src/utils/pickSnapshot";

const SNAPSHOTS = [-10000, -5000, -3000, -2000, -1000, -500, 0, 500, 1000, 1492, 1800, 2000];

describe("pickSnapshotYear", () => {
  it("returns exact match when target is a snapshot year", () => {
    expect(pickSnapshotYear(SNAPSHOTS, 1492)).toBe(1492);
  });

  it("returns the nearest snapshot at or before the target", () => {
    expect(pickSnapshotYear(SNAPSHOTS, 1600)).toBe(1492);
    expect(pickSnapshotYear(SNAPSHOTS, 1799)).toBe(1492);
    expect(pickSnapshotYear(SNAPSHOTS, 1800)).toBe(1800);
  });

  it("returns the first snapshot when target is before all snapshots", () => {
    expect(pickSnapshotYear(SNAPSHOTS, -20000)).toBe(-10000);
  });

  it("returns the last snapshot when target is after all snapshots", () => {
    expect(pickSnapshotYear(SNAPSHOTS, 2025)).toBe(2000);
  });

  it("handles a single-element list", () => {
    expect(pickSnapshotYear([1900], 1850)).toBe(1900);
    expect(pickSnapshotYear([1900], 1950)).toBe(1900);
  });

  it("throws on an empty list", () => {
    expect(() => pickSnapshotYear([], 1492)).toThrow();
  });

  it("handles negative years correctly", () => {
    expect(pickSnapshotYear(SNAPSHOTS, -1500)).toBe(-2000);
    expect(pickSnapshotYear(SNAPSHOTS, -999)).toBe(-1000);
  });
});
