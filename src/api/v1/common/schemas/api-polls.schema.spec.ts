import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ApiPollCreateSchema,
  ApiPollOfferedTypeSchema,
  ApiPollQuerySchema,
  ApiPollUpdateSchema,
  MAX_DESCRIPTION,
  MAX_LABEL,
  MAX_OPTIONS,
  MAX_TITLE,
} from './api-polls.schema';
import { LIMIT_BY_ROLE } from './api-pagination.schema';

const prismaSchema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

function declaredLength(model: string, column: string): number | null {
  const block = new RegExp(`model ${model} \\{[^}]*\\}`).exec(prismaSchema);
  if (!block) return null;
  const declared = new RegExp(
    `\\b${column}\\s+\\S+\\s+[^\\n]*@db\\.VarChar\\((\\d+)\\)`,
  ).exec(block[0]);
  return declared ? Number(declared[1]) : null;
}

const inTheFuture = new Date(Date.now() + 3600_000);
const inThePast = new Date(Date.now() - 1000);

const body = (over: Record<string, unknown> = {}) => ({
  title: 'Best fruit',
  type: 'single_choice',
  visibility: 'public',
  allowChangeVote: true,
  isAnonymous: false,
  endsAt: inTheFuture,
  options: [
    { text: 'Pear', order: 0 },
    { text: 'Fig', order: 1 },
  ],
  ...over,
});

const options = (count: number) =>
  Array.from({ length: count }, (unused, index) => ({
    text: `Option ${index}`,
    order: index,
  }));

describe('the lengths the api enforces', () => {
  it('matches what the columns can actually hold', () => {
    expect(declaredLength('Poll', 'title')).toBe(MAX_TITLE);
    expect(declaredLength('Option', 'text')).toBe(MAX_LABEL);
  });

  it('accepts a title of exactly the column width, and refuses one over', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ title: 'x'.repeat(MAX_TITLE) }))
        .success,
    ).toBe(true);
    expect(
      ApiPollCreateSchema.safeParse(body({ title: 'x'.repeat(MAX_TITLE + 1) }))
        .success,
    ).toBe(false);
  });

  it('refuses an empty title', () => {
    expect(ApiPollCreateSchema.safeParse(body({ title: '' })).success).toBe(
      false,
    );
  });

  it('holds a description up to its own ceiling', () => {
    expect(
      ApiPollCreateSchema.safeParse(
        body({ description: 'x'.repeat(MAX_DESCRIPTION) }),
      ).success,
    ).toBe(true);
    expect(
      ApiPollCreateSchema.safeParse(
        body({ description: 'x'.repeat(MAX_DESCRIPTION + 1) }),
      ).success,
    ).toBe(false);
  });
});

describe('when a poll may end', () => {
  it('refuses a date already gone', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ endsAt: inThePast })).success,
    ).toBe(false);
  });

  it('refuses the present instant, which leaves no time to vote', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ endsAt: new Date() })).success,
    ).toBe(false);
  });

  it('accepts any moment still ahead', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ endsAt: inTheFuture })).success,
    ).toBe(true);
  });

  it('applies the same rule to an edit', () => {
    expect(ApiPollUpdateSchema.safeParse({ endsAt: inThePast }).success).toBe(
      false,
    );
    expect(ApiPollUpdateSchema.safeParse({ endsAt: inTheFuture }).success).toBe(
      true,
    );
  });
});

describe('how many options each type takes', () => {
  it('refuses a choice poll with one option, accepts two', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ options: options(1) })).success,
    ).toBe(false);
    expect(
      ApiPollCreateSchema.safeParse(body({ options: options(2) })).success,
    ).toBe(true);
  });

  it('accepts the ceiling and refuses one more', () => {
    expect(
      ApiPollCreateSchema.safeParse(body({ options: options(MAX_OPTIONS) }))
        .success,
    ).toBe(true);
    expect(
      ApiPollCreateSchema.safeParse(body({ options: options(MAX_OPTIONS + 1) }))
        .success,
    ).toBe(false);
  });

  it('takes exactly one option for a slider, never two', () => {
    for (const [count, accepted] of [
      [0, false],
      [1, true],
      [2, false],
    ] as const) {
      expect(
        ApiPollCreateSchema.safeParse(
          body({ type: 'slider', options: options(count) }),
        ).success,
      ).toBe(accepted);
    }
  });

  it('refuses a free field poll outright: the type is not offered', () => {
    for (const count of [0, 1]) {
      expect(
        ApiPollCreateSchema.safeParse(
          body({ type: 'free_field', options: options(count) }),
        ).success,
      ).toBe(false);
    }
  });

  it('offers exactly the types the api knows how to tally', () => {
    expect(ApiPollOfferedTypeSchema.options.sort()).toEqual([
      'multiple_choice',
      'single_choice',
      'slider',
    ]);
  });

  it('refuses two options claiming the same position', () => {
    expect(
      ApiPollCreateSchema.safeParse(
        body({
          options: [
            { text: 'Pear', order: 0 },
            { text: 'Fig', order: 0 },
          ],
        }),
      ).success,
    ).toBe(false);
  });
});

describe('the query the list accepts', () => {
  it('defaults to the first page', () => {
    expect(ApiPollQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
  });

  it('stops at the highest ceiling any role could ask for', () => {
    expect(
      ApiPollQuerySchema.safeParse({ limit: LIMIT_BY_ROLE.admin }).success,
    ).toBe(true);
    expect(
      ApiPollQuerySchema.safeParse({ limit: LIMIT_BY_ROLE.admin + 1 }).success,
    ).toBe(false);
  });

  it('refuses page zero, which no offset can express', () => {
    expect(ApiPollQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(ApiPollQuerySchema.safeParse({ page: 1 }).success).toBe(true);
  });

  it('refuses a filter the api does not offer', () => {
    expect(ApiPollQuerySchema.safeParse({ sort: 'title' }).success).toBe(false);
  });
});
