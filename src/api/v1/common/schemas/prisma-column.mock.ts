import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaSchema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

const VARCHAR = '@db.VarChar(';

export function declaredLength(model: string, column: string): number | null {
  const start = prismaSchema.indexOf(`model ${model} {`);
  if (start === -1) return null;

  const closes = prismaSchema.indexOf('}', start);
  const line = prismaSchema
    .slice(start, closes === -1 ? undefined : closes)
    .split('\n')
    .find((row) => row.trim().startsWith(`${column} `));
  if (!line) return null;

  const opens = line.indexOf(VARCHAR);
  if (opens === -1) return null;

  const from = opens + VARCHAR.length;
  return Number(line.slice(from, line.indexOf(')', from)));
}
