import { Global, Module } from '@nestjs/common';
import { WebsocketEmitter } from './websocket.emitter';

@Global()
@Module({
  providers: [WebsocketEmitter],
  exports: [WebsocketEmitter],
})
export class WebsocketModule {}
