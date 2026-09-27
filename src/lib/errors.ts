export type DomainErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "INVALID_TRANSITION";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const HTTP_STATUS: Record<DomainErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
};
