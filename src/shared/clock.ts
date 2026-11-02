/** Injected wherever time matters (quote expiry) so tests are deterministic (NFR-02). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const at = new Date(iso);
  return { now: () => new Date(at) };
}
