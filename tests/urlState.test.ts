import { describe, it, expect } from "vitest";
import { __layerLetterMap } from "../src/utils/urlState";

describe("layer letter mapping", () => {
  it("maps all 13 layers to unique single letters", () => {
    const entries = Object.entries(__layerLetterMap);
    expect(entries).toHaveLength(13);

    const letters = entries.map(([letter]) => letter);
    const unique = new Set(letters);
    expect(unique.size).toBe(13);

    for (const letter of letters) {
      expect(letter).toMatch(/^[a-z]$/);
    }
  });

  it("includes all expected layers", () => {
    const layerIds = Object.values(__layerLetterMap);
    expect(layerIds).toContain("boundaries");
    expect(layerIds).toContain("peoples");
    expect(layerIds).toContain("cities");
    expect(layerIds).toContain("events");
    expect(layerIds).toContain("connections");
    expect(layerIds).toContain("battles");
    expect(layerIds).toContain("population");
    expect(layerIds).toContain("sealevel");
    expect(layerIds).toContain("religions");
    expect(layerIds).toContain("languages");
    expect(layerIds).toContain("disasters");
    expect(layerIds).toContain("people");
    expect(layerIds).toContain("migrations");
  });

  it("maps known letters to expected layers", () => {
    expect(__layerLetterMap["b"]).toBe("boundaries");
    expect(__layerLetterMap["p"]).toBe("peoples");
    expect(__layerLetterMap["x"]).toBe("battles");
    expect(__layerLetterMap["y"]).toBe("sealevel");
    expect(__layerLetterMap["m"]).toBe("migrations");
  });
});
