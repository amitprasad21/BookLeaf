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
    ]) {
      expect(safeNextPath(value)).toBe("/tickets");
    }
  });

  it("never sends the admin back to the sign-in page", () => {
    expect(safeNextPath("/login?reason=expired")).toBe("/tickets");
    expect(safeNextPath(null)).toBe("/tickets");
  });
});
