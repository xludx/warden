export type SuccessResponse<T> = { success: true; data: T };
export type ListResponse<T> = { success: true; data: T[] };
export type ErrorResponse = { success: false; error: string };

export const successResponse = <T>(data: T): SuccessResponse<T> => ({
  success: true,
  data,
});

export const listResponse = <T>(data: T[]): ListResponse<T> => ({
  success: true,
  data,
});
