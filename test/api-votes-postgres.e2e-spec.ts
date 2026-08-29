import { ConflictException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { User } from '../src/generated/prisma/client';
import { VaultService } from '../src/vault/vault.service';
import { CaslAbilityFactory } from '../src/casl/casl-ability.factory';
import { ApiPollVoteService } from '../src/api/v1/polls/vote/vote.service';
import type { ApiVoteCastDTO } from '../src/api/v1/common/schemas/api-votes.schema';

const PREFIX = `iv${Date.now().toString(36)}_`;
const ENDS_AT = new Date(Date.now() + 7 * 24 * 3600 * 1000);

describe('Casting a vote, against postgres', () => {
  let prisma: PrismaClient;
  let service: ApiPollVoteService;
  let voter: User;
  let pollId = 0;
  let optionIds: number[] = [];

  beforeAll(async () => {
    const vault = new VaultService();
    await vault.init();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: vault.db.database_url }),
    });
    service = new ApiPollVoteService(prisma, new CaslAbilityFactory());

    voter = await prisma.user.create({
      data: {
        username: `${PREFIX}voter`,
        email: `${PREFIX}voter@example.test`,
        birthdate: new Date('1990-01-01'),
        passwordHash: 'not-a-real-hash',
        gender: 'other',
        nationality: 'testland',
      },
    });

    const poll = await prisma.poll.create({
      data: {
        title: `${PREFIX}poll`,
        type: 'single_choice',
        visibility: 'public',
        allowChangeVote: true,
        isAnonymous: false,
        status: 'pending',
        endsAt: ENDS_AT,
        createdById: voter.id,
        options: {
          create: [
            { text: 'Pear', order: 0 },
            { text: 'Fig', order: 1 },
          ],
        },
      },
      select: { id: true, options: { select: { id: true } } },
    });
    pollId = poll.id;
    optionIds = poll.options.map((option) => option.id);
  });

  afterAll(async () => {
    await prisma.voteOption.deleteMany({ where: { vote: { pollId } } });
    await prisma.vote.deleteMany({ where: { pollId } });
    await prisma.option.deleteMany({ where: { pollId } });
    await prisma.poll.deleteMany({ where: { id: pollId } });
    await prisma.user.deleteMany({ where: { id: voter.id } });
    await prisma.$disconnect();
  });

  const ballot = (optionId: number): ApiVoteCastDTO => ({
    type: 'single_choice',
    optionIds: [optionId],
  });

  it('writes the vote and publishes the pending poll', async () => {
    const vote = await service.castVote(pollId, ballot(optionIds[0]), voter);

    expect(vote.optionIds).toEqual([optionIds[0]]);

    const poll = await prisma.poll.findUniqueOrThrow({
      where: { id: pollId },
      select: { status: true, publishedAt: true },
    });
    expect(poll.status).toBe('active');
    expect(poll.publishedAt).not.toBeNull();
  });

  it('refuses a second vote from the same voter', async () => {
    await expect(
      service.castVote(pollId, ballot(optionIds[1]), voter),
    ).rejects.toThrow(ConflictException);
  });

  it('replaces the selection when the vote changes', async () => {
    await service.changeVote(pollId, ballot(optionIds[1]), voter);

    const stored = await prisma.voteOption.findMany({
      where: { vote: { pollId, createdById: voter.id } },
      select: { optionId: true },
    });
    expect(stored.map((row) => row.optionId)).toEqual([optionIds[1]]);
  });

  it('withdraws without removing the row', async () => {
    await service.withdrawVote(pollId, voter);

    const vote = await prisma.vote.findFirstOrThrow({
      where: { pollId, createdById: voter.id },
      select: { deletedAt: true },
    });
    expect(vote.deletedAt).not.toBeNull();
  });

  it('keeps the selection when a change carries only the slider value', async () => {
    const slider = await prisma.poll.create({
      data: {
        title: `${PREFIX}slider`,
        type: 'slider',
        visibility: 'public',
        allowChangeVote: true,
        isAnonymous: false,
        status: 'active',
        endsAt: ENDS_AT,
        createdById: voter.id,
        options: { create: [{ text: 'How ripe', order: 0 }] },
      },
      select: { id: true, options: { select: { id: true } } },
    });
    const optionId = slider.options[0].id;

    await service.castVote(
      slider.id,
      { type: 'slider', optionIds: [optionId], freeField: '5' },
      voter,
    );

    const changed = await service.changeVote(
      slider.id,
      { type: 'slider', freeField: '9' },
      voter,
    );

    expect(changed.freeField).toBe('9');
    expect(changed.optionIds).toEqual([optionId]);

    await prisma.voteOption.deleteMany({
      where: { vote: { pollId: slider.id } },
    });
    await prisma.vote.deleteMany({ where: { pollId: slider.id } });
    await prisma.option.deleteMany({ where: { pollId: slider.id } });
    await prisma.poll.deleteMany({ where: { id: slider.id } });
  });

  it('revives the same row when the voter comes back', async () => {
    const before = await prisma.vote.findFirstOrThrow({
      where: { pollId, createdById: voter.id },
      select: { id: true },
    });

    const vote = await service.castVote(pollId, ballot(optionIds[0]), voter);

    expect(vote.id).toBe(before.id);
    expect(vote.optionIds).toEqual([optionIds[0]]);
    expect(await prisma.vote.count({ where: { pollId } })).toBe(1);
  });
});
