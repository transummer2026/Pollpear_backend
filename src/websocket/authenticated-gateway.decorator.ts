import { UseFilters, UseGuards, applyDecorators } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { AuthGuard } from 'src/auth/auth.guard';
import { WsExceptionsFilter } from './ws-exceptions.filter';

/**
 * Composed decorator for feature websocket gateways: every gateway gets
 * the auth guard and the catch-all exception filter in one place, so a
 * new gateway cannot forget either of them.
 */
export function AuthenticatedGateway(): ClassDecorator {
  return applyDecorators(
    WebSocketGateway(),
    UseGuards(AuthGuard),
    UseFilters(WsExceptionsFilter),
  );
}
