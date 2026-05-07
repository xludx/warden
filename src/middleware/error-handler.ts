import { Elysia } from "elysia";
import { ServiceError } from "@/errors/service-errors";
import { logger } from "@/util/logger";

export const errorHandlerMiddleware = new Elysia({ name: "error.handler" }).onError(
  { as: "global" },
  (context) => {
    const { code, error, set } = context;
    const requestId = (context as { requestId?: string }).requestId;
    if (requestId) set.headers["x-request-id"] = requestId;
    if (error instanceof ServiceError) {
      set.status = error.statusCode;
      if (error.statusCode >= 500) {
        logger.error({ error: error.message }, "Service error (5xx)");
      } else {
        logger.warn({ error: error.message }, "Service error (4xx)");
      }
      return { success: false, error: error.message, requestId };
    }

    if (code === "VALIDATION" || "issues" in error) {
      set.status = 400;
      const details = "issues" in error ? (error as { issues: unknown }).issues : undefined;
      return { success: false, error: "Invalid request", details, requestId };
    }

    set.status = 500;
    logger.error({
      error: String(error),
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      requestId,
    }, "Unhandled error");
    return { success: false, error: "Internal server error", requestId };
  }
);
