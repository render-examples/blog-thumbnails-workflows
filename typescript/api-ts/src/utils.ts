/**
 * SDK helpers, error mapping, and utility functions.
 */
import { AbortError, ClientError, RenderError, ServerError } from "@renderinc/sdk";

/** Map Render SDK errors to HTTP status codes and messages. */
export function toSdkErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof AbortError) {
    return { status: 504, message: "Request to Render API timed out" };
  }
  if (error instanceof ClientError) {
    return {
      status: error.statusCode ?? 400,
      message: error.message || "Invalid request to Render API",
    };
  }
  if (error instanceof ServerError) {
    return {
      status: error.statusCode ?? 502,
      message: "Render API error",
    };
  }
  if (error instanceof RenderError) {
    return { status: 502, message: error.message || "Render API error" };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Unexpected error",
  };
}

/** Log detailed error information for debugging. */
export function logFullError(label: string, error: unknown): void {
  console.error(`[API] ${label}:`, error);
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (e.statusCode) {
      console.error(`  statusCode: ${e.statusCode}`);
    }
    if (e.response) {
      console.error(`  response: ${JSON.stringify(e.response)}`);
    }
    if (e.body) {
      console.error(`  body: ${JSON.stringify(e.body)}`);
    }
    if (e.cause) {
      console.error(`  cause: ${JSON.stringify(e.cause)}`);
    }
    if (e.stack) {
      console.error(`  stack: ${e.stack}`);
    }
    const props = Object.keys(e).filter((k) => !["stack", "message"].includes(k));
    if (props.length > 0) {
      console.error(`  props: ${props.join(", ")}`);
      for (const prop of props) {
        try {
          console.error(`  ${prop}: ${JSON.stringify(e[prop])}`);
        } catch {
          console.error(`  ${prop}: [not serializable]`);
        }
      }
    }
  }
}

/** Extract a meaningful error message from an exception. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("[object Object]")) {
      const anyErr = error as unknown as Record<string, unknown>;
      if (anyErr.body) {
        return JSON.stringify(anyErr.body);
      }
      if (anyErr.response) {
        return JSON.stringify(anyErr.response);
      }
      if (anyErr.cause) {
        return extractErrorMessage(anyErr.cause);
      }
    }
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (obj.message && typeof obj.message === "string") {
      return obj.message;
    }
    if (obj.error && typeof obj.error === "string") {
      return obj.error;
    }
    return JSON.stringify(error);
  }
  return "Unknown error";
}
