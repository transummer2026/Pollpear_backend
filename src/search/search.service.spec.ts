import { ZodError } from 'zod';
import { RoomsService } from 'src/rooms/rooms.service';
import { UsersService } from 'src/users/users.service';
import { SearchService } from './search.service';
import type { SearchQueryDTO } from 'Pollpear_shared/src/schemas/search.schema';
import type { User } from 'src/generated/prisma/client';

const users = [
  {
    id: 1,
    username: 'alice',
    name: 'Alice',
    surname: null,
    avatarUrl: '/uploads/avatars/default.svg',
  },
];
const rooms = [{ id: 3, name: 'orchard' }];
const viewer = { id: 42, role: 'user' } as User;

function query(overrides: Partial<SearchQueryDTO> = {}): SearchQueryDTO {
  return {
    q: 'pear',
    type: 'all',
    page: 1,
    limit: 10,
    sortBy: 'relevance',
    ...overrides,
  };
}

describe('SearchService', () => {
  const searchUsers = jest.fn();
  const searchRooms = jest.fn();
  const service = new SearchService(
    { search: searchUsers } as unknown as UsersService,
    { search: searchRooms } as unknown as RoomsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    searchUsers.mockResolvedValue({ items: users, total: users.length });
    searchRooms.mockResolvedValue({ items: rooms, total: rooms.length });
  });

  it('fans out to both services for a global search, capped to a preview page', async () => {
    await expect(
      service.search(query({ type: 'all' }), viewer),
    ).resolves.toEqual({
      users,
      usersTotal: users.length,
      rooms,
      roomsTotal: rooms.length,
    });

    expect(searchUsers).toHaveBeenCalledWith('pear', viewer, {
      page: 1,
      limit: 5,
      sortBy: 'relevance',
    });
    expect(searchRooms).toHaveBeenCalledWith('pear', viewer, {
      page: 1,
      limit: 5,
      sortBy: 'relevance',
    });
  });

  it('queries only the users service for a user search, forwarding page/limit/sortBy', async () => {
    await expect(
      service.search(
        query({ type: 'user', page: 2, limit: 20, sortBy: 'alphabetical' }),
        viewer,
      ),
    ).resolves.toEqual({
      users,
      usersTotal: users.length,
      rooms: [],
      roomsTotal: 0,
    });

    expect(searchUsers).toHaveBeenCalledWith('pear', viewer, {
      page: 2,
      limit: 20,
      sortBy: 'alphabetical',
    });
    expect(searchRooms).not.toHaveBeenCalled();
  });

  it('empties the users collection for a room search', async () => {
    await expect(
      service.search(query({ type: 'room' }), viewer),
    ).resolves.toEqual({
      users: [],
      usersTotal: 0,
      rooms,
      roomsTotal: rooms.length,
    });

    expect(searchUsers).not.toHaveBeenCalled();
    expect(searchRooms).toHaveBeenCalledWith('pear', viewer, {
      page: 1,
      limit: 10,
      sortBy: 'relevance',
    });
  });

  it('rejects a result row that breaks the shared schema', async () => {
    searchUsers.mockResolvedValue({ items: [{ id: 1 }], total: 1 });

    await expect(
      service.search(query({ type: 'user' }), viewer),
    ).rejects.toThrow(ZodError);
  });
});
