// Per-provider circuit breaker (.back/AI_PROVIDER_ORCHESTRATION.md section 4).
// In-memory: one backend instance (A-15). Closed -> open after N consecutive
// transient failures; open -> half-open after the cooldown (one probe call);
// a failed probe re-opens with a doubled cooldown, capped. Configuration
// problems (bad key, no model access) stay open until restart.

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  maxCooldownMs?: number;
  now?: () => number;
}

export interface CircuitSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  /** Epoch ms when an open circuit next allows a probe; null while closed or held open. */
  retryAt: number | null;
  /** Set when held open by a configuration problem (until restart). */
  heldOpen: boolean;
}

export class CircuitBreaker {
  private failures = 0;
  private openedUntil: number | null = null;
  private currentCooldown: number;
  private probing = false;
  private held = false;
  private readonly now: () => number;
  private readonly maxCooldown: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
    this.currentCooldown = options.cooldownMs;
    this.maxCooldown = options.maxCooldownMs ?? 10 * 60_000;
  }

  get state(): CircuitState {
    if (this.held) return "open";
    if (this.openedUntil === null) return "closed";
    return this.now() >= this.openedUntil ? "half_open" : "open";
  }

  /** Whether a call may go out now. In half-open state only one probe is let through. */
  tryAcquire(): boolean {
    const state = this.state;
    if (state === "closed") return true;
    if (state === "half_open" && !this.probing) {
      this.probing = true;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedUntil = null;
    this.probing = false;
    this.currentCooldown = this.options.cooldownMs;
  }

  /** A transient failure (rate limit, overload, timeout, connection). */
  recordFailure(): void {
    this.failures += 1;
    if (this.probing) {
      this.probing = false;
      this.currentCooldown = Math.min(this.currentCooldown * 2, this.maxCooldown);
      this.openedUntil = this.now() + this.currentCooldown;
    } else if (this.failures >= this.options.failureThreshold) {
      this.openedUntil = this.now() + this.currentCooldown;
    }
  }

  /** Open for a known window (e.g. a provider quota that resets later). */
  openFor(ms: number): void {
    this.probing = false;
    this.openedUntil = this.now() + ms;
  }

  /** A configuration problem: stays open until the process restarts with new config. */
  holdOpen(): void {
    this.probing = false;
    this.held = true;
  }

  snapshot(): CircuitSnapshot {
    const state = this.state;
    return {
      state,
      consecutiveFailures: this.failures,
      retryAt: this.held || state === "closed" ? null : this.openedUntil,
      heldOpen: this.held,
    };
  }
}
