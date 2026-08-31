import {
  ApiRoomCreateSchema,
  ApiRoomColumnsSchema,
  ApiRoomListColumnsSchema,
  ApiRoomQuerySchema,
  ApiRoomUpdateSchema,
  MAX_DESCRIPTION,
  MAX_NAME,
} from './api-rooms.schema';
import { LIMIT_BY_ROLE } from './api-pagination.schema';
import { declaredLength } from './prisma-column.mock';
import { RoomCreateSchema } from 'Pollpear_shared/src/schemas/rooms.schema';

const inTheFuture = new Date(Date.now() + 3600_000);
const inThePast = new Date(Date.now() - 1000);

const body = (over: Record<string, unknown> = {}) => ({
  name: 'Fruit lovers',
  visibility: 'public',
  ...over,
});

describe('the lengths the api enforces', () => {
  it('matches what the column can actually hold', () => {
    expect(declaredLength('Room', 'name')).toBe(MAX_NAME);
  });

  it('accepts a name of exactly the column width, and refuses one over', () => {
    expect(
      ApiRoomCreateSchema.safeParse(body({ name: 'x'.repeat(MAX_NAME) }))
        .success,
    ).toBe(true);
    expect(
      ApiRoomCreateSchema.safeParse(body({ name: 'x'.repeat(MAX_NAME + 1) }))
        .success,
    ).toBe(false);
  });

  it('refuses an empty name', () => {
    expect(ApiRoomCreateSchema.safeParse(body({ name: '' })).success).toBe(
      false,
    );
  });
});

describe('the bounds the api shares with the internal contract', () => {
  const bodies = [
    { label: 'a name over the limit', over: { name: 'x'.repeat(256) } },
    {
      label: 'a description over the limit',
      over: { description: 'x'.repeat(MAX_DESCRIPTION + 1) },
    },
    { label: 'an end date in the past', over: { endsAt: inThePast } },
  ];

  it.each(bodies)('refuses $label on both sides', ({ over }) => {
    expect(ApiRoomCreateSchema.safeParse(body(over)).success).toBe(false);
    expect(RoomCreateSchema.safeParse(body(over)).success).toBe(false);
  });

  it.each([
    {
      label: 'a description at the limit',
      over: { description: 'x'.repeat(MAX_DESCRIPTION) },
    },
    { label: 'an end date in the future', over: { endsAt: inTheFuture } },
  ])('accepts $label on both sides', ({ over }) => {
    expect(ApiRoomCreateSchema.safeParse(body(over)).success).toBe(true);
    expect(RoomCreateSchema.safeParse(body(over)).success).toBe(true);
  });
});

describe('ApiRoomCreateSchema', () => {
  it('refuses a field nobody declared', () => {
    expect(ApiRoomCreateSchema.safeParse(body({ sneaky: 1 })).success).toBe(
      false,
    );
  });

  it('never lets the body choose the owner, the status or the banner', () => {
    for (const field of ['createdById', 'status', 'bannerUrl']) {
      expect(
        ApiRoomCreateSchema.safeParse(body({ [field]: 'anything' })).success,
      ).toBe(false);
    }
  });

  it('takes a room with no description and no end date', () => {
    expect(ApiRoomCreateSchema.safeParse(body()).success).toBe(true);
  });

  it('needs a visibility, since the column has no default', () => {
    const { visibility, ...withoutVisibility } = body();
    void visibility;

    expect(ApiRoomCreateSchema.safeParse(withoutVisibility).success).toBe(
      false,
    );
  });

  it('refuses a visibility outside the enum', () => {
    expect(
      ApiRoomCreateSchema.safeParse(body({ visibility: 'unlisted' })).success,
    ).toBe(false);
  });
});

describe('ApiRoomUpdateSchema', () => {
  it('takes a single field', () => {
    expect(ApiRoomUpdateSchema.safeParse({ name: 'Renamed' }).success).toBe(
      true,
    );
  });

  it('refuses an empty body rather than writing nothing', () => {
    expect(ApiRoomUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('refuses the status, which no route lets a client write', () => {
    expect(ApiRoomUpdateSchema.safeParse({ status: 'closed' }).success).toBe(
      false,
    );
  });

  it('clears a description with null, and refuses null on the name', () => {
    expect(ApiRoomUpdateSchema.safeParse({ description: null }).success).toBe(
      true,
    );
    expect(ApiRoomUpdateSchema.safeParse({ name: null }).success).toBe(false);
  });
});

describe('ApiRoomQuerySchema', () => {
  it('pages from 1 when the query says nothing', () => {
    expect(ApiRoomQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
  });

  it('refuses a parameter nobody declared', () => {
    expect(ApiRoomQuerySchema.safeParse({ sort: 'name' }).success).toBe(false);
  });

  it('refuses a limit past the highest ceiling', () => {
    expect(
      ApiRoomQuerySchema.safeParse({ limit: LIMIT_BY_ROLE.admin + 1 }).success,
    ).toBe(false);
  });

  it('reads the filters as the types the columns hold', () => {
    expect(
      ApiRoomQuerySchema.parse({ createdBy: '7', status: 'active' }),
    ).toMatchObject({ createdBy: 7, status: 'active' });
  });
});

describe('the payload columns', () => {
  it('never carries what the policy reads but the caller must not see', () => {
    for (const schema of [ApiRoomListColumnsSchema, ApiRoomColumnsSchema]) {
      expect(Object.keys(schema.shape)).not.toContain('deletedAt');
      expect(Object.keys(schema.shape)).not.toContain('createdById');
    }
  });

  it('keeps the list lighter than the detail', () => {
    expect(Object.keys(ApiRoomListColumnsSchema.shape).length).toBeLessThan(
      Object.keys(ApiRoomColumnsSchema.shape).length,
    );
  });
});
