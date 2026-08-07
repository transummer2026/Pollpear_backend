import { UseFilters, UseGuards, applyDecorators } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { WsAuthGuard } from './ws-auth.guard';
import { WsExceptionsFilter } from './ws-exceptions.filter';

/**
 * Composed decorator for feature websocket gateways: every gateway gets
 * the auth guard and the catch-all exception filter in one place, so a
 * new gateway cannot forget either of them.
 */
export function FeatureGateway(): ClassDecorator {
  return applyDecorators(
    WebSocketGateway(),
    UseGuards(WsAuthGuard),
    UseFilters(WsExceptionsFilter),
  );
}
