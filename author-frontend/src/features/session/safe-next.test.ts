import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/tickets/new?bookId=BK001")).toBe("/tickets/new?bookId=BK001");
  });

  it("refuses other origins, protocol-relative and backslash tricks", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(value)).toBe("/books");
    }
  });

  it("never sends the author back to the sign-in page", () => {
    expect(safeNextPath("/login?reason=expired")).toBe("/books");
    expect(safeNextPath(null)).toBe("/books");
  });
});
