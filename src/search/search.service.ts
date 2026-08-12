import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { PollsService } from 'src/polls/polls.service';
import { RoomsService } from 'src/rooms/rooms.service';
import {
  SearchResultsSchema,
  type SearchQueryDTO,
  type SearchResultsDTO,
} from 'Pollpear_shared/src/schemas/search.schema';

@Injectable()
export class SearchService {
  constructor(
    private usersService: UsersService,
    private pollsService: PollsService,
    private roomsService: RoomsService,
  ) {}

  async search({ q, type }: SearchQueryDTO): Promise<SearchResultsDTO> {
    const [users, polls, rooms] = await Promise.all([
      type === 'all' || type === 'user' ? this.usersService.search(q) : [],
      type === 'all' || type === 'poll' ? this.pollsService.search(q) : [],
      type === 'all' || type === 'room' ? this.roomsService.search(q) : [],
    ]);

    return SearchResultsSchema.parse({ users, polls, rooms });
  }
}
