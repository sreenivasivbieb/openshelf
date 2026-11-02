/** Money is stored and compared as integer minor units (cents). Floats only at the API edge (ADR-0006). */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

export function toMajor(minor: number): number {
  return minor / 100;
}
