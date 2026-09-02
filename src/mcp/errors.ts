import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export const RESOURCE_NOT_FOUND = -32002;

export function invalidParameter(message: string): never {
  throw new McpError(ErrorCode.InvalidParams, message);
}

export function resourceNotFound(uri: URL, entity: string): never {
  throw new McpError(RESOURCE_NOT_FOUND, `${entity} not found: ${uri.href}`);
}

export function decodeVariable(value: string, label: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.trim()) invalidParameter(`Invalid ${label}: value is empty`);
    return decoded;
  } catch (error) {
    if (error instanceof McpError) throw error;
    return invalidParameter(`Invalid ${label} encoding: ${value}`);
  }
}
