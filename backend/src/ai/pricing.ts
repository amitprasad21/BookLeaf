// List prices in USD per 1M tokens, used only for the `estimated_cost_usd`
// estimate on usage events. Verified 2026-10-18 against ai.google.dev pricing
// (updated 2026-10-16) and GroqCloud's model page. Calls on a free tier are
// not billed; the estimate shows what the same traffic would cost on the paid
// tier. Unknown models (and the mock) estimate to 0.

interface ModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Gemini paid-tier prices through 2026-12-31 (they rise on 2027-01-01).
  "gemini-3.8-flash": { input: 0.75, cachedInput: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, cachedInput: 0.3, output: 2.5 },
  "openai/gpt-oss-120b": { input: 0.15, cachedInput: 0.075, output: 0.6 },
};

export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number },
): number {
  const price = PRICES[model];
  if (!price) return 0;
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cacheReadTokens);
  const cost =
    (uncachedInput * price.input +
      usage.cacheReadTokens * price.cachedInput +
      usage.outputTokens * price.output) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // numeric(10, 6)
}
