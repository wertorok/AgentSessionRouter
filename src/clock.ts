export interface Clock {
  now(): Date;
  nowIso(): string;
  nowMillis(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  nowMillis(): number {
    return this.now().getTime();
  }
}

export const systemClock = new SystemClock();

export function isoFromMillis(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

export function daysBetweenIso(clock: Clock, earlierIso: string): number {
  const earlier = new Date(earlierIso).getTime();
  return Math.max(0, (clock.nowMillis() - earlier) / 86_400_000);
}

export function isoMinutesAgo(clock: Clock, minutes: number): string {
  return isoFromMillis(clock.nowMillis() - minutes * 60_000);
}

export function isoHoursAgo(clock: Clock, hours: number): string {
  return isoFromMillis(clock.nowMillis() - hours * 3_600_000);
}

export function isoDaysAgo(clock: Clock, days: number): string {
  return isoFromMillis(clock.nowMillis() - days * 86_400_000);
}

