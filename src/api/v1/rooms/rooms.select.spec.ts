import { roomWithCounts } from './rooms.service';
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
