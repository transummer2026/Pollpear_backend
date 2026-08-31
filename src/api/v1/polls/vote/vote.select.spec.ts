import { pollForBallot } from './vote.service';
import { pollVotableConditions } from 'src/casl/permissions/poll';
import { AuthorizationUser } from 'src/casl/permissions/role';
import { UserRole } from 'src/generated/prisma/enums';

const PRISMA_OPERATORS = new Set([
  'is',
  'isNot',
  'some',
  'every',
  'none',
  'not',
  'in',
  'notIn',
  'AND',
  'OR',
  'NOT',
]);

type Tree = Record<string, unknown>;

const isTree = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function fieldsOfCondition(node: unknown, prefix = ''): string[] {
  if (!isTree(node)) {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (PRISMA_OPERATORS.has(key)) {
      return fieldsOfCondition(value, prefix);
    }

    const path = prefix ? `${prefix}.${key}` : key;

    return [path, ...fieldsOfCondition(value, path)];
  });
}

function fieldsOfSelect(node: unknown, prefix = ''): string[] {
  if (!isTree(node)) {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (key === 'select') {
      return fieldsOfSelect(value, prefix);
    }
    if (key === 'where') {
      return [];
    }

    const path = prefix ? `${prefix}.${key}` : key;

    return [path, ...fieldsOfSelect(value, path)];
  });
}

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
