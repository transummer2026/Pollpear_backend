import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `schema.prisma` cannot express CHECK constraints — Prisma has no `@@check`
 * (verified: the validator rejects it). The canonical-pair invariants therefore
 * live only as hand-written SQL inside the baseline migration, which makes them
 * invisible to `prisma migrate diff`: regenerating or squashing the migration
 * history from the schema silently drops them, and nothing else would notice.
 *
 * This test is that "something else". See `friendship.pair.ts` for the code
 * that relies on them.
 *
 * The path is a constant rather than a directory walk on purpose: building it
 * from `readdirSync` entries trips the semgrep path-traversal rule in CI. The
 * coupling is a feature — squashing the history again renames this file, the
 * read throws, and whoever did it has to decide deliberately where the
 * constraints now live instead of losing them silently.
 */
const BASELINE_MIGRATION = join(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260831000000_init',
  'migration.sql',
);

describe('friendship canonical-pair SQL constraints', () => {
  const sql = readFileSync(BASELINE_MIGRATION, 'utf8');

  it('keeps the pair-order constraint in the baseline migration', () => {
    expect(sql).toContain('friendships_pair_order_check');
    // user_a_id < user_b_id, relaxed once the row is soft-deleted
    expect(sql).toMatch(
      /CHECK\s*\(\s*"user_a_id"\s*<\s*"user_b_id"\s+OR\s+"deleted_at"\s+IS\s+NOT\s+NULL\s*\)/i,
    );
  });

  it('keeps the addressee-in-pair constraint in the baseline migration', () => {
    expect(sql).toContain('friendships_addressee_in_pair_check');
    expect(sql).toMatch(
      /CHECK\s*\(\s*"addressee_id"\s+IN\s*\(\s*"user_a_id"\s*,\s*"user_b_id"\s*\)\s*\)/i,
    );
  });
});
