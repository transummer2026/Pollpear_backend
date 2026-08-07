import { WsException } from '@nestjs/websockets';
import { wsExecutionContextMock } from './ws-execution-context.mock';
import { WsAuthGuard } from './ws-auth.guard';

describe('WsAuthGuard', () => {
  const guard = new WsAuthGuard();

  it('accepts a socket bound to a user', () => {
    expect(guard.canActivate(wsExecutionContextMock({ userId: 42 }))).toBe(
      true,
    );
  });

  it('throws a WsException for an unbound socket', () => {
    expect(() => guard.canActivate(wsExecutionContextMock({}))).toThrow(
      WsException,
    );
  });
});
