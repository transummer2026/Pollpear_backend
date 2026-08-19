import { ZodError } from 'zod';
import { PollsService } from 'src/polls/polls.service';
import { RoomsService } from 'src/rooms/rooms.service';
import { UsersService } from 'src/users/users.service';
import { SearchService } from './search.service';

const users = [
  {
    id: 1,
    username: 'alice',
    name: 'Alice',
    surname: null,
    avatarUrl: '/uploads/avatars/default.svg',
  },
];
const polls = [{ id: 2, title: 'Best pear variety?' }];
const rooms = [{ id: 3, name: 'orchard' }];

describe('SearchService', () => {
  const searchUsers = jest.fn();
  const searchPolls = jest.fn();
  const searchRooms = jest.fn();
  const service = new SearchService(
    { search: searchUsers } as unknown as UsersService,
    { search: searchPolls } as unknown as PollsService,
    { search: searchRooms } as unknown as RoomsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    searchUsers.mockResolvedValue(users);
    searchPolls.mockResolvedValue(polls);
    searchRooms.mockResolvedValue(rooms);
  });

  it('fans out to the three services for a global search', async () => {
    await expect(service.search({ q: 'pear', type: 'all' })).resolves.toEqual({
      users,
      polls,
      rooms,
    });

    expect(searchUsers).toHaveBeenCalledWith('pear');
    expect(searchPolls).toHaveBeenCalledWith('pear');
    expect(searchRooms).toHaveBeenCalledWith('pear');
  });

  it('queries only the users service for a user search', async () => {
    await expect(service.search({ q: 'pear', type: 'user' })).resolves.toEqual({
      users,
      polls: [],
      rooms: [],
    });

    expect(searchUsers).toHaveBeenCalledWith('pear');
    expect(searchPolls).not.toHaveBeenCalled();
    expect(searchRooms).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'poll' as const, expected: { users: [], polls, rooms: [] } },
    { type: 'room' as const, expected: { users: [], polls: [], rooms } },
  ])(
    'empties the other collections for a $type search',
    async ({ type, expected }) => {
      await expect(service.search({ q: 'pear', type })).resolves.toEqual(
        expected,
      );
    },
  );

  it('rejects a result row that breaks the shared schema', async () => {
    searchUsers.mockResolvedValue([{ id: 1 }]);

    await expect(service.search({ q: 'pear', type: 'user' })).rejects.toThrow(
      ZodError,
    );
  });
});
