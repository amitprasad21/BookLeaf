import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/tickets?status=open&sort=urgency")).toBe("/tickets?status=open&sort=urgency");
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
      expect(safeNextPath(value)).toBe("/tickets");
    }
  });

  it("returns the path as the router will read it", () => {
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
    expect(safeNextPath("/queue/../tickets?status=open")).toBe("/tickets?status=open");
  });

  it("never sends the admin back to the sign-in page", () => {
    expect(safeNextPath("/login?reason=expired")).toBe("/tickets");
    expect(safeNextPath("/login/")).toBe("/tickets");
    expect(safeNextPath(null)).toBe("/tickets");
  });
});
