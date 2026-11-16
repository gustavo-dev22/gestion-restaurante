export class CajaError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "CajaError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function isCajaError(error: unknown): error is CajaError {
  return error instanceof CajaError;
}
