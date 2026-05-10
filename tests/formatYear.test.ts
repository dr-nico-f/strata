import { describe, it, expect } from "vitest";
import { formatYear, wikipediaUrl } from "../src/store";

describe("formatYear", () => {
  it("formats positive years as CE", () => {
    expect(formatYear(2025)).toBe("2,025 CE");
    expect(formatYear(1)).toBe("1 CE");
  });

  it("formats negative years as BCE", () => {
    expect(formatYear(-3000)).toBe("3,000 BCE");
    expect(formatYear(-1)).toBe("1 BCE");
  });

  it("treats year 0 as 1 BCE", () => {
    expect(formatYear(0)).toBe("1 BCE");
  });

  it("formats large prehistoric years", () => {
    expect(formatYear(-10000)).toBe("10,000 BCE");
  });
});

describe("wikipediaUrl", () => {
  it("builds a URL from a plain slug", () => {
    expect(wikipediaUrl("Roman Empire")).toBe("https://en.wikipedia.org/wiki/Roman_Empire");
  });

  it("returns full URLs unchanged", () => {
    const url = "https://en.wikipedia.org/wiki/Rome";
    expect(wikipediaUrl(url)).toBe(url);
  });

  it("encodes special characters", () => {
    expect(wikipediaUrl("Göbekli Tepe")).toContain("G%C3%B6bekli_Tepe");
  });
});
