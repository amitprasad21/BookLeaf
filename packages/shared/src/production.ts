// Book production stages from the BookLeaf Knowledge Base (kb.production).
// Book status is stored as written in the dataset: "Published & Live" or
// "In Production - <stage>".

export const PUBLISHED_STATUS = "Published & Live";

/** Production stages in order. */
export const PRODUCTION_STAGES = [
  "Manuscript Received",
  "Editing",
  "Cover Design",
  "Typesetting",
  "Proofreading",
  "ISBN Assignment",
  "Printing",
  "Distribution Setup",
  "Published & Live",
] as const;

const IN_PRODUCTION = /^In Production - (.+)$/;

export interface ProductionStage {
  stage: string;
  /** 1-based position in PRODUCTION_STAGES; 0 for a stage the KB doesn't list. */
  number: number;
  of: number;
}

/** Where an in-production book stands, or null when the status isn't "In Production - …". */
export function productionStage(status: string): ProductionStage | null {
  const stage = IN_PRODUCTION.exec(status)?.[1];
  if (!stage) return null;
  const index = PRODUCTION_STAGES.indexOf(stage as (typeof PRODUCTION_STAGES)[number]);
  return { stage, number: index + 1, of: PRODUCTION_STAGES.length };
}
