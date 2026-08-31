import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * `schema.prisma` cannot express CHECK constraints — Prisma has no `@@check`
 * (verified: the validator rejects it). The canonical-pair invariants therefore
 * live only as hand-written SQL inside a migration, which makes them invisible
 * to `prisma migrate diff`: regenerating or squashing the migration history
 * from the schema silently drops them, and nothing else would notice.
 *
 * This test is that "something else". It reads the migrations on disk and fails
 * if either constraint is gone, so a future squash has to carry them over
 * deliberately. See `friendship.pair.ts` for the code that relies on them.
 */
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      readFileSync(join(MIGRATIONS_DIR, entry.name, 'migration.sql'), 'utf8'),
    )
    .join('\n');
}

describe('friendship canonical-pair SQL constraints', () => {
  const sql = allMigrationSql();

  it('keeps the pair-order constraint in the migration history', () => {
    expect(sql).toContain('friendships_pair_order_check');
    // user_a_id < user_b_id, relaxed once the row is soft-deleted
    expect(sql).toMatch(
      /CHECK\s*\(\s*"user_a_id"\s*<\s*"user_b_id"\s+OR\s+"deleted_at"\s+IS\s+NOT\s+NULL\s*\)/i,
    );
  });

  it('keeps the addressee-in-pair constraint in the migration history', () => {
    expect(sql).toContain('friendships_addressee_in_pair_check');
    expect(sql).toMatch(
      /CHECK\s*\(\s*"addressee_id"\s+IN\s*\(\s*"user_a_id"\s*,\s*"user_b_id"\s*\)\s*\)/i,
    );
  });
});
