// Mock responders for every AI task, keyed by schema name (used by the mock provider).
import type { MockResponder } from "../providers/mock.js";
import { DRAFT_SCHEMA_NAME, mockDraftResponder } from "./draft.js";
import { TRIAGE_MOCK_RESPONDERS } from "./triage.js";

export const MOCK_RESPONDERS: Record<string, MockResponder> = {
  ...TRIAGE_MOCK_RESPONDERS,
  [DRAFT_SCHEMA_NAME]: mockDraftResponder,
};
