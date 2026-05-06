import { Elysia } from "elysia";
import { ServiceError } from "@/errors/service-errors";
import { logger } from "@/util/logger";

export const errorHandlerMiddleware = new Elysia({ name: "error.handler" }).onError(
  ({ error, set }) => {
    if (error instanceof ServiceError) {
      set.status = error.statusCode;
      if (error.statusCode >= 500) {
        logger.error({ error: error.message }, "Service error (5xx)");
      } else {
        logger.warn({ error: error.message }, "Service error (4xx)");
      }
      return { success: false, error: error.message };
    }

    if ("issues" in error) {
      set.status = 400;
      return { success: false, error: "Invalid request", details: (error as { issues: unknown }).issues };
    }

    set.status = 500;
    logger.error({ error: String(error) }, "Unhandled error");
    return { success: false, error: "Internal server error" };
  }
);
