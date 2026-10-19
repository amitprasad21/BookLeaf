// The support console shows knowledge base and policy-floor names from
// packages/shared; these checks keep them in step with the backend sources.
import { KB_SECTION_LABELS, POLICY_FLOOR_LABELS } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import { KB_SECTIONS } from "../src/ai/knowledge-base/index.js";
import { PRIORITY_FLOORS } from "../src/ai/validation/floors.js";

describe("shared labels", () => {
  it("name every knowledge base section by its first line", () => {
    const titles = Object.fromEntries(
      Object.entries(KB_SECTIONS).map(([id, text]) => [id, text.split("\n")[0]]),
    );
    expect(KB_SECTION_LABELS).toEqual(titles);
  });

  it("describe every priority floor rule", () => {
    expect(Object.keys(POLICY_FLOOR_LABELS).sort()).toEqual(
      PRIORITY_FLOORS.map((floor) => floor.rule).sort(),
    );
  });
});
