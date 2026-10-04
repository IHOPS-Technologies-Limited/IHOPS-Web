import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// Prisma throws its own error classes (PrismaClientKnownRequestError,
// PrismaClientValidationError, etc.) whose .message is an internal-debugging
// string like "Invalid `prisma.patient.update()` invocation ... Unknown
// argument `bloodGroup`." That's exactly what leaks to the browser if it's
// passed straight through as `err.message` below — which is both an
// information leak and, in practice, the single most common cause of a
// confusing raw-looking error in this app: the Prisma Client was generated
// from a schema.prisma with a field the database itself doesn't have yet,
// because a migration wasn't run after pulling a schema change. Detect that
// shape specifically and say so, instead of dumping the internal message.
function isPrismaError(err: any): boolean {
  return typeof err?.name === "string" && err.name.startsWith("Prisma");
}
function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || "");
  return /Unknown argument|no such column|does not exist in the current database/i.test(
    msg,
  );
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    // A human-readable summary in `error` (e.g. "email: Invalid email"),
    // plus the full structured list in `issues` for anything that wants to
    // highlight individual fields. Previously `error` was just the literal
    // string "VALIDATION_ERROR" — impossible to debug from the UI without
    // opening dev tools, since nothing on the frontend rendered `issues`.
    const summary = err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return res
      .status(400)
      .json({ error: summary || "Validation failed", issues: err.issues });
  }

  console.error(err);

  if (isPrismaError(err)) {
    if (isMissingColumnError(err)) {
      return res.status(500).json({
        error:
          "The database is missing a column the app expects. Run `npx prisma migrate dev` in the backend folder, then restart the server.",
      });
    }
    return res
      .status(500)
      .json({
        error: "A database error occurred. Check the server logs for details.",
      });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}
