import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { VaultService } from '../src/vault/vault.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { accessibleBy } from '../src/casl/casl-prisma';
import { UserRole } from '../src/generated/prisma/client';

/**
 * The one question the e2e suites cannot answer: they assert the where clause
 * the service hands to Prisma, never the rows postgres hands back. Here the
 * real filter runs against a real database, on rows this file creates and
 * removes, so what is being checked is the translation into SQL: that a
 * private account is genuinely absent, and that an account which blocked the
 * caller genuinely disappears from their list.
 *
 * Ce qui est eprouve ici est la clause que produit accessibleBy, pas une
 * copie: si la politique change, ce fichier change avec elle.
 *
 * La connexion vient de vault, comme pour le seed, donc il n'y a aucun fichier
 * d'environnement a preparer. En contrepartie la suite a besoin de la stack et
 * de l'entrypoint qui fournit les identifiants approle. Elle parle a une vraie
 * base, sous le nom d'hote du reseau docker, et tourne donc dans le conteneur:
 *
 *   docker compose -f ./Pollpear_infra/compose.yml \
 *     -f ./Pollpear_infra/compose.dev.yml run --rm backend npm run test:e2e
 *
 * Lancee sans ca, elle echoue en le disant. Elle skippait en silence avant, ce
 * qui l'a laissee ne jamais tourner pendant des semaines.
 *
 * Every row it writes is prefixed, and dropped in afterAll: pointing this at
 * a shared database costs it a handful of rows for the length of a run.
 */
const PREFIX = `iv${Date.now().toString(36)}_`;
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 7 * 24 * 3600 * 1000);

const abilityFor = (id: number, role: UserRole) =>
  new CaslAbilityFactory().createForUser({ id, role });

describe('The visibility filter, against postgres', () => {
  let prisma: PrismaClient;

  const ids: Record<string, number> = {};

  const addUser = async (
    key: string,
    over: { visibility?: 'private'; deletedAt?: Date } = {},
  ) => {
    const user = await prisma.user.create({
      data: {
        username: `${PREFIX}${key}`,
        email: `${PREFIX}${key}@example.test`,
        birthdate: new Date('1990-01-01'),
        passwordHash: 'not-a-real-hash',
        gender: 'other',
        nationality: 'testland',
        ...over,
      },
      select: { id: true },
    });
    ids[key] = user.id;
    return user.id;
  };

  const addBan = (
    userId: number,
    over: { endedAt?: Date; unbannedById?: number } = {},
  ) =>
    prisma.ban.create({
      data: {
        banReason: 'integration check',
        startedAt: PAST,
        endedAt: FUTURE,
        userId,
        bannedById: ids.listed,
        ...over,
      },
    });

  /** Only the accounts this suite created, so a populated database cannot skew the answer. */
  const listedFor = async (role: UserRole) => {
    const ability = abilityFor(ids.caller, role);
    const rows = await prisma.user.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType('User'),
          { username: { startsWith: PREFIX } },
        ],
      },
      select: { username: true },
    });
    return rows.map((row) => row.username.slice(PREFIX.length)).sort();
  };

  beforeAll(async () => {
    const vault = new VaultService();
    await vault.init();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: vault.db.database_url }),
    });

    await addUser('caller');
    await addUser('listed');
    await addUser('hidden', { visibility: 'private' });
    await addUser('gone', { deletedAt: new Date() });
    const banned = await addUser('banned');
    const pardoned = await addUser('pardoned');
    const served = await addUser('served');

    await addBan(banned);
    await addBan(pardoned, { unbannedById: ids.listed });
    await addBan(served, { endedAt: PAST });

    const blocker = await addUser('blocker');
    await prisma.block.create({
      data: { blockerId: blocker, blockedId: ids.caller },
    });
  });

  afterAll(async () => {
    const mine = Object.values(ids);
    await prisma.block.deleteMany({ where: { blockerId: { in: mine } } });
    await prisma.ban.deleteMany({ where: { userId: { in: mine } } });
    await prisma.user.deleteMany({ where: { id: { in: mine } } });
    await prisma.$disconnect();
  });

  const EVERY_ROLE = [UserRole.user, UserRole.moderator, UserRole.admin];

  it.each(EVERY_ROLE)(
    'keeps a private account out of a %s list',
    async (role) => {
      expect(await listedFor(role)).not.toContain('hidden');
    },
  );

  it.each(EVERY_ROLE)(
    'keeps a deleted account out of a %s list',
    async (role) => {
      expect(await listedFor(role)).not.toContain('gone');
    },
  );

  /**
   * Un compte qui a bloque l'appelant sort de sa liste, quel que soit son
   * role: c'est la politique qui le dit, et cette assertion prouve que la
   * traduction en SQL le fait vraiment.
   */
  it.each(EVERY_ROLE)(
    'hides an account that blocked the %s caller',
    async (role) => {
      expect(await listedFor(role)).not.toContain('blocker');
    },
  );

  /**
   * Le bannissement n'est pas une affaire de visibilite: la politique n'en
   * parle pas, donc un banni reste liste. Ce qui le concerne vit sur sa
   * propre route.
   */
  it.each(EVERY_ROLE)('still lists a banned account for a %s', async (role) => {
    expect(await listedFor(role)).toContain('banned');
  });

  it('answers nothing at all for a private profile, which is the 404', async () => {
    const ability = abilityFor(ids.caller, UserRole.user);
    const found = await prisma.user.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('User'), { id: ids.hidden }],
      },
      select: { id: true },
    });

    expect(found).toBeNull();
  });

  it('answers the row for a listed profile, same query', async () => {
    const ability = abilityFor(ids.caller, UserRole.user);
    const found = await prisma.user.findFirst({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('User'), { id: ids.listed }],
      },
      select: { id: true },
    });

    expect(found).toEqual({ id: ids.listed });
  });
});
