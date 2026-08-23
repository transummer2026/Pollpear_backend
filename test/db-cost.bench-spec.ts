import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type User } from '../src/generated/prisma/client';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { ApiUsersService } from '../src/api/v1/users/users.service';
import { ApiUserProfileService } from '../src/api/v1/users/profile/profile.service';
import { ApiPollsService } from '../src/api/v1/polls/polls.service';

const url = process.env.TEST_DATABASE_URL;
const describeWithDb = url ? describe : describe.skip;

if (!url) {
  console.warn('TEST_DATABASE_URL is not set: the cost bench was skipped.');
}

const VOLUMES = [1_000, 50_000] as const;
const PAGE = { page: 1, limit: 20 };

type Sample = { table: string; duration: number };

describeWithDb('what each route costs', () => {
  const samples: Sample[] = [];
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: [{ emit: 'event', level: 'query' }],
  });

  const tableOf = (query: string) => {
    if (/count\(/i.test(query)) return 'count';
    const from = /FROM "public"\."(\w+)"/i.exec(query);
    return from ? from[1] : 'other';
  };

  prisma.$on('query', (event) => {
    if (/^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)/i.test(event.query)) return;
    samples.push({ table: tableOf(event.query), duration: event.duration });
  });

  const db = prisma as unknown as PrismaService;
  const abilities = new CaslAbilityFactory();
  const users = new ApiUsersService(db, abilities);
  const profiles = new ApiUserProfileService(db, abilities);
  const polls = new ApiPollsService(db, abilities);

  let caller: User;
  const rows: string[] = [];

  const scenarios = (volume: number) => [
    { label: 'GET /v1/users', run: () => users.findAllUsers(PAGE, caller) },
    {
      label: 'GET /v1/users/{id}',
      run: () => profiles.findOneUser(caller.id, caller),
    },
    { label: 'GET /v1/polls', run: () => polls.findAllPolls(PAGE, caller) },
    {
      label: 'GET /v1/polls (deep page)',
      run: () =>
        polls.findAllPolls(
          { page: Math.floor(volume / 40), limit: 20 },
          caller,
        ),
    },
  ];

  const measure = async (
    label: string,
    volume: number,
    run: () => Promise<unknown>,
  ) => {
    await run();
    samples.length = 0;
    const started = performance.now();
    await run();
    const wall = performance.now() - started;
    const detail = samples
      .map((sample) => `${sample.table} ${sample.duration.toFixed(1)}ms`)
      .join(', ');
    rows.push(
      `${label.padEnd(26)} | ${String(volume).padStart(6)} | ${wall.toFixed(1).padStart(6)}ms | ${detail}`,
    );
  };

  const bulkUsers = (from: number, count: number) =>
    prisma.user.createMany({
      data: Array.from({ length: count }, (unused, index) => ({
        username: `bench${from + index}`,
        email: `bench${from + index}@example.test`,
        birthdate: new Date('1990-01-01'),
        passwordHash: 'x',
        gender: 'other' as const,
        nationality: 'benchland',
      })),
    });

  const bulkPolls = (from: number, count: number) =>
    prisma.poll.createMany({
      data: Array.from({ length: count }, (unused, index) => ({
        title: `bench${from + index}`,
        type: 'single_choice' as const,
        visibility: 'public' as const,
        allowChangeVote: true,
        isAnonymous: false,
        status: 'active' as const,
        endsAt: new Date(Date.now() + 86_400_000),
        createdById: caller.id,
      })),
    });

  beforeAll(async () => {
    caller = await prisma.user.create({
      data: {
        username: 'benchcaller',
        email: 'bench@example.test',
        birthdate: new Date('1990-01-01'),
        passwordHash: 'x',
        gender: 'other',
        nationality: 'benchland',
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.poll.deleteMany({ where: { title: { startsWith: 'bench' } } });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'bench' } },
    });
    await prisma.$disconnect();

    const header = `${'route'.padEnd(26)} |   rows |   wall | per statement`;
    console.log(
      `\n${header}\n${'-'.repeat(header.length)}\n${rows.join('\n')}`,
    );
  }, 120_000);

  it('measures every route at each volume', async () => {
    let seeded = 0;

    for (const volume of VOLUMES) {
      await bulkUsers(seeded, volume - seeded);
      await bulkPolls(seeded, volume - seeded);
      await prisma.$executeRawUnsafe('ANALYZE');
      seeded = volume;

      for (const scenario of scenarios(volume)) {
        await measure(scenario.label, volume, scenario.run);
      }
    }

    expect(rows).toHaveLength(VOLUMES.length * scenarios(0).length);
  }, 600_000);
});
