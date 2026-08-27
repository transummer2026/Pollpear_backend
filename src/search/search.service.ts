import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RoomsService } from 'src/rooms/rooms.service';
import type { User } from 'src/generated/prisma/client';
import {
  SearchResultsSchema,
  type SearchQueryDTO,
  type SearchResultsDTO,
} from 'Pollpear_shared/src/schemas/search.schema';
import { SEARCH_RESULTS_LIMIT } from 'src/search/search-options';

@Injectable()
export class SearchService {
  constructor(
    private usersService: UsersService,
    private roomsService: RoomsService,
  ) {}

  async search(
    { q, type, page, limit, sortBy }: SearchQueryDTO,
    viewer: User,
  ): Promise<SearchResultsDTO> {
    const isScoped = type !== 'all';
    const options = isScoped
      ? { page, limit, sortBy }
      : { page: 1, limit: SEARCH_RESULTS_LIMIT, sortBy };

    const [users, rooms] = await Promise.all([
      type === 'all' || type === 'user'
        ? this.usersService.search(q, viewer, options)
        : { items: [], total: 0 },
      type === 'all' || type === 'room'
        ? this.roomsService.search(q, viewer, options)
        : { items: [], total: 0 },
    ]);

    return SearchResultsSchema.parse({
      users: users.items,
      usersTotal: users.total,
      rooms: rooms.items,
      roomsTotal: rooms.total,
    });
  }
}
