// Daily token budget (.back/AI_PROVIDER_ORCHESTRATION.md section 5): input +
// output tokens recorded since 00:00 Asia/Kolkata. The database total is
// cached for 30 s and topped up locally after each call, so a burst can't
// overshoot by more than the calls already in flight.
import { businessDate, businessDayStart } from "@bookleaf/shared";

export interface BudgetOptions {
  dailyTokens: number;
  /** Tokens recorded since the given instant (system writer). */
  usedSince: (sinceIso: string) => Promise<number>;
  now?: () => Date;
  cacheMs?: number;
}

export interface BudgetStatus {
  date: string;
  budgetTokens: number;
  usedTokens: number;
}

export interface DailyBudget {
  exhausted(): Promise<boolean>;
  /** Count tokens just spent without waiting for the next refresh. */
  add(tokens: number): void;
  status(): Promise<BudgetStatus>;
}

const dayStart = (date: string) => businessDayStart(date).toISOString();

export function createDailyBudget(options: BudgetOptions): DailyBudget {
  const now = options.now ?? (() => new Date());
  const cacheMs = options.cacheMs ?? 30_000;
  let cached: { date: string; used: number; fetchedAt: number } | null = null;

  async function used(): Promise<{ date: string; used: number }> {
    const current = now();
    const date = businessDate(current);
    if (!cached || cached.date !== date || current.getTime() - cached.fetchedAt > cacheMs) {
      cached = { date, used: await options.usedSince(dayStart(date)), fetchedAt: current.getTime() };
    }
    return cached;
  }

  return {
    async exhausted() {
      return (await used()).used >= options.dailyTokens;
    },
    add(tokens) {
      if (cached && cached.date === businessDate(now())) cached.used += tokens;
    },
    async status() {
      const { date, used: usedTokens } = await used();
      return { date, budgetTokens: options.dailyTokens, usedTokens };
    },
  };
}
