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

export function fieldsOfCondition(node: unknown, prefix = ''): string[] {
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

export function fieldsOfSelect(node: unknown, prefix = ''): string[] {
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
