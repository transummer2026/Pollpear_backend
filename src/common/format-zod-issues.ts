import { ZodError } from 'zod';

/**
 * Flattens zod issues into a single log line. Shared by the HTTP and
 * websocket validation pipes and by the Vault config validation.
 * @param error the zod error to format
 * @returns {string} the issues as "path: message", comma separated
 */
export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
}
