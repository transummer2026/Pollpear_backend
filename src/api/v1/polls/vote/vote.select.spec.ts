import { pollForBallot } from './vote.service';
import { pollVotableConditions } from 'src/casl/permissions/poll';
import { AuthorizationUser } from 'src/casl/permissions/role';
import { UserRole } from 'src/generated/prisma/enums';
import {
  fieldsOfCondition,
  fieldsOfSelect,
} from '../../common/policy-fields.mock';

describe('pollForBallot', () => {
  const user = new AuthorizationUser(7, UserRole.user);

  it('reads every column the vote policy asks a poll about', () => {
    const needed = new Set(
      pollVotableConditions(user).flatMap((condition) =>
        fieldsOfCondition(condition),
      ),
    );
    const selected = new Set(fieldsOfSelect(pollForBallot(7)));
    const missing = [...needed].filter((field) => !selected.has(field));

    expect({ missing, selected: [...selected] }).toMatchObject({ missing: [] });
  });

  it('knows what it is comparing, rather than passing on an empty set', () => {
    const needed = pollVotableConditions(user).flatMap((condition) =>
      fieldsOfCondition(condition),
    );

    expect(needed).toEqual(expect.arrayContaining(['visibility', 'roomId']));
    expect(fieldsOfSelect(pollForBallot(7)).length).toBeGreaterThan(5);
  });
});
