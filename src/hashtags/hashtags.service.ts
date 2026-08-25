import { ForbiddenError, subject } from '@casl/ability';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppAbility } from 'src/casl/casl-prisma';
import { Hashtag, Prisma } from 'src/generated/prisma/client';
import { PollUpdateDTO } from 'Pollpear_shared/src/schemas/polls.schema';

const UNIQUE_CONSTRAINT_FAILED = 'P2002';

function isNameAlreadyTaken(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_FAILED
  );
}

@Injectable()
export class HashtagsService {
  constructor(private prisma: PrismaService) {}

  async resolveHashtag(name: string, ability: AppAbility) {
    const hashtag = await this.prisma.hashtag.findUnique({ where: { name } });

    return hashtag === null
      ? this.createHashtag(name, ability)
      : this.useExisting(hashtag, ability);
  }

  private async createHashtag(name: string, ability: AppAbility) {
    ForbiddenError.from(ability).throwUnlessCan('create', 'Hashtag');

    try {
      const created = await this.prisma.hashtag.create({ data: { name } });
      return { hashtagId: created.id };
    } catch (error) {
      if (!isNameAlreadyTaken(error)) throw error;

      const winner = await this.prisma.hashtag.findUniqueOrThrow({
        where: { name },
      });
      return this.useExisting(winner, ability);
    }
  }

  private useExisting(hashtag: Hashtag, ability: AppAbility) {
    if (hashtag.deletedAt !== null) {
      throw new ConflictException(`Hashtag "${hashtag.name}" is not available`);
    }

    ForbiddenError.from(ability).throwUnlessCan(
      'read',
      subject('Hashtag', hashtag),
    );

    return { hashtagId: hashtag.id };
  }

  /**
   * hashtags undefined => field absent from the request => leave hashtags as is.
   * hashtags === [] => field explicitly sent empty => clear them.
   */
  async buildHashtagsNestedWrite(
    pollId: number,
    hashtags: PollUpdateDTO['hashtags'],
    ability: AppAbility,
  ) {
    if (hashtags === undefined) return undefined;

    const hashtagNames = hashtags.map((hashtag) => hashtag.name);
    const currentHashtags = await this.prisma.pollHashtag.findMany({
      where: { pollId },
      include: { hashtag: true },
    });
    const currentHashtagNames = currentHashtags.map(
      (pollHashtag) => pollHashtag.hashtag.name,
    );

    const hashtagsToCreate = hashtagNames.filter(
      (name) => !currentHashtagNames.includes(name),
    );
    const hashtagsToDisconnect = currentHashtags
      .filter((pollHashtag) => !hashtagNames.includes(pollHashtag.hashtag.name))
      .map(({ pollId, hashtagId }) => ({ pollId, hashtagId }));

    return {
      create: await Promise.all(
        hashtagsToCreate.map((name) => this.resolveHashtag(name, ability)),
      ),
      deleteMany: hashtagsToDisconnect,
    };
  }
}
