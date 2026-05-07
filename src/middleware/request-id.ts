import { Elysia } from "elysia";
import { nanoid } from "nanoid";

export const requestIdMiddleware = new Elysia({ name: "request.id" })
  .derive(() => ({
    requestId: nanoid(),
  }))
  .onAfterHandle({ as: "global" }, ({ requestId, set }) => {
    set.headers["x-request-id"] = requestId;
  });
