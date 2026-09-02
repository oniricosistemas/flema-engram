export class EngramUnavailable extends Error {
  public readonly kind: EngramErrorKind;
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(message: string, cause?: Error, opts?: { kind?: EngramErrorKind; statusCode?: number; endpoint?: string }) {
    super(message, cause ? { cause } : undefined);
    this.name = "EngramUnavailable";
    this.kind = opts?.kind ?? "connection";
    this.statusCode = opts?.statusCode;
    this.endpoint = opts?.endpoint;
  }
}

export type EngramErrorKind = "connection" | "timeout" | "http" | "parse" | "validation";

export class ValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotImplemented extends Error {
  constructor(message = "Not implemented") {
    super(message);
    this.name = "NotImplemented";
  }
}
