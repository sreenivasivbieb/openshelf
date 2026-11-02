/** A known, safe-to-show error. The HTTP error middleware turns it into { error: { code, message } }. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Marks code that is not built yet. Surfaces as HTTP 501, so every route exists from day one. */
export function notImplemented(step: string): never {
  throw new AppError("NOT_IMPLEMENTED", `Not implemented yet (build ${step})`, 501);
}
