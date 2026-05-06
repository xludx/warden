export abstract class ServiceError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends ServiceError {
  readonly statusCode = 404;

  constructor(entity: string, id?: string) {
    super(id ? `${entity} '${id}' not found` : `${entity} not found`);
  }
}

export class ValidationError extends ServiceError {
  readonly statusCode = 400;
}

export class ConflictError extends ServiceError {
  readonly statusCode = 409;
}

export class UnauthorizedError extends ServiceError {
  readonly statusCode = 401;
}

export class ForbiddenError extends ServiceError {
  readonly statusCode = 403;
}
