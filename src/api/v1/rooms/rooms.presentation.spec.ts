import { matching } from './rooms.presentation';
import type { ApiRoomQueryDTO } from '../common/schemas/api-rooms.schema';

const page: ApiRoomQueryDTO = { page: 1, limit: 20 };

describe('matching', () => {
  it('asks for nothing when the query carries no filter', () => {
    expect(matching(page)).toEqual({});
  });

  it('never turns a filter into a visibility rule of its own', () => {
    expect(matching({ ...page, visibility: 'private' })).toEqual({
      visibility: 'private',
    });
  });

  it('reads the author filter as the column that holds it', () => {
    expect(matching({ ...page, createdBy: 7 })).toEqual({ createdById: 7 });
  });

  it('combines every filter it is given', () => {
    expect(
      matching({
        ...page,
        status: 'closed',
        visibility: 'public',
        createdBy: 7,
      }),
    ).toEqual({ status: 'closed', visibility: 'public', createdById: 7 });
  });
});
