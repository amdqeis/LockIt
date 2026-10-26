import { NextResponse } from "next/server";

export interface ApiResponseSuccess<T = any> {
  success: true;
  data: T;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = ApiResponseSuccess<T> | ApiResponseError;

export function successResponse<T>(data: T, status: number = 200, headers?: HeadersInit): NextResponse<ApiResponseSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers,
    }
  );
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: any,
  headers?: HeadersInit
): NextResponse<ApiResponseError> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    {
      status,
      headers,
    }
  );
}
