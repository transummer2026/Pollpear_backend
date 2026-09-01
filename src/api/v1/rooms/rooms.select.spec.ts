import { LIST_SELECT, roomWithCounts } from './rooms.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { UserRole } from 'src/generated/prisma/enums';
import type { User } from 'src/generated/prisma/client';
import {
  fieldsOfCondition,
  fieldsOfSelect,
} from '../common/policy-fields.mock';

const owner = { id: 7, role: UserRole.user } as unknown as User;

describe('roomWithCounts', () => {
  const ability = new CaslAbilityFactory().createForUser(owner);

  const askedAbout = (action: 'update' | 'delete') =>
    ability
      .possibleRulesFor(action, 'Room')
      .flatMap((rule) => fieldsOfCondition(rule.conditions));

  const needed = () => [...askedAbout('update'), ...askedAbout('delete')];

  it('reads every column the write rules ask a room about', () => {
    const selected = new Set(fieldsOfSelect(roomWithCounts(ability)));
    const missing = [...new Set(needed())].filter(
      (field) => !selected.has(field),
    );

    expect({ missing, selected: [...selected] }).toMatchObject({ missing: [] });
  });

  it('knows what it is comparing, rather than passing on an empty set', () => {
    expect(needed()).toEqual(
      expect.arrayContaining(['status', 'createdById', 'deletedAt']),
    );
  });
});

/**
 * Status reconciliation reads the deadline off the rows already loaded:
 * dropping `endsAt` from either select would silence it without breaking
 * compilation, and an expired room would keep being served as active.
 */
describe('the columns syncRoomStatuses requires', () => {
  const ability = new CaslAbilityFactory().createForUser(owner);

  it.each([
    ['the list', () => LIST_SELECT as Record<string, unknown>],
    ['the detail', () => roomWithCounts(ability) as Record<string, unknown>],
  ])('%s carries them all', (unused, select) => {
    expect(Object.keys(select())).toEqual(
      expect.arrayContaining(['id', 'status', 'endsAt']),
    );
  });
});
