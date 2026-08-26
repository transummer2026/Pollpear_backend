import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { UsersModule } from 'src/users/users.module';
import { RoomsModule } from 'src/rooms/rooms.module';

@Module({
  imports: [UsersModule, RoomsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
