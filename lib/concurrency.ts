import { Prisma } from "@prisma/client";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 80;

export function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
  }
  if (error instanceof Error) {
    return (
      error.message.includes("2601") ||
      error.message.includes("2627") ||
      error.message.toLowerCase().includes("duplicate")
    );
  }
  return false;
}

export function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  if (error instanceof Error) {
    return (
      error.message.includes("1205") ||
      error.message.toLowerCase().includes("deadlock") ||
      error.message.toLowerCase().includes("write conflict")
    );
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = MAX_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}
