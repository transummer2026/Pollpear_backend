import { ExecutionContext } from '@nestjs/common';

/**
 * Minimal websocket ExecutionContext for specs: a socket carrying the
 * given data (the user binding) and an optional event payload.
 */
export function wsExecutionContextMock(
  data: Record<string, unknown>,
  payload: unknown = {},
): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => ({ id: 'socket-1', data }),
      getData: () => payload,
    }),
  } as unknown as ExecutionContext;
}
