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
      // The URL parser drops tabs and newlines, so "/<tab>/host" is "//host".
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r\n/evil.example",
      "/section/..//evil.example",
      "/%2e%2e//evil.example",
    ]) {
      expect(safeNextPath(value)).toBe("/books");
    }
  });

  it("returns the path as the router will read it", () => {
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
    expect(safeNextPath("/tickets/../books#royalties")).toBe("/books#royalties");
  });

  it("never sends the author back to the sign-in page", () => {
    expect(safeNextPath("/login?reason=expired")).toBe("/books");
    expect(safeNextPath("/login/")).toBe("/books");
    expect(safeNextPath(null)).toBe("/books");
  });
});
