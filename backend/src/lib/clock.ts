// All "now" comes from here so tests can pin dates (payout windows, SLA, ages).
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
