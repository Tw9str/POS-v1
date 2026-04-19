import { NextResponse } from "next/server";

/**
 * Maps Prisma error codes to user-friendly messages and HTTP status codes.
 * Returns null if the error isn't a known Prisma error.
 */
export function handlePrismaError(err: unknown): NextResponse | null {
  if (!isPrismaError(err)) return null;

  switch (err.code) {
    // Unique constraint violation
    case "P2002": {
      const field = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(", ")
        : "field";
      return NextResponse.json(
        { error: `A record with this ${field} already exists.` },
        { status: 409 },
      );
    }
    // Record not found (for update/delete)
    case "P2025":
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    // Foreign key constraint violation
    case "P2003": {
      const field = (err.meta?.field_name as string) || "record";
      return NextResponse.json(
        {
          error: `Cannot delete because ${field} is still referenced by other records.`,
        },
        { status: 409 },
      );
    }
    // Required relation not found
    case "P2018":
      return NextResponse.json(
        { error: "A required related record was not found." },
        { status: 404 },
      );
    default:
      return null;
  }
}

/**
 * Standard 500 error response for API routes.
 * Catches Prisma errors first; falls back to generic 500.
 */
export function apiError(err: unknown, context?: string): NextResponse {
  // Check for Prisma-specific error first
  const prismaResponse = handlePrismaError(err);
  if (prismaResponse) return prismaResponse;

  // Database connection errors
  if (isDbConnectionError(err)) {
    return NextResponse.json(
      { error: "Database is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  // Log unexpected errors (server-side only)
  if (context) {
    console.error(`${context}:`, err);
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Check if error is a PrismaClientKnownRequestError-like object */
function isPrismaError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown>; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("P")
  );
}

/** Check if error indicates DB connection failure */
function isDbConnectionError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg =
    "message" in err ? String((err as { message: unknown }).message) : "";
  return (
    msg.includes("Can't reach database") ||
    msg.includes("Connection refused") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connection timeout") ||
    msg.includes("too many connections")
  );
}

/**
 * Wraps a server-component DB query with clean error messages.
 * Re-throws with a user-friendly message so error.tsx can display it.
 */
export async function dbQuery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isDbConnectionError(err)) {
      throw new Error(
        "Could not connect to the database. Please check your connection and try again.",
      );
    }
    if (isPrismaError(err)) {
      throw new Error("A database error occurred. Please try again.");
    }
    throw err;
  }
}
