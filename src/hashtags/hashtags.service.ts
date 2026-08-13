import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PollUpdateDTO } from 'Pollpear_shared/src/schemas/polls.schema';

@Injectable()
export class HashtagsService {
  constructor(private prisma: PrismaService) {}

  async connectOrCreateHashtag(name: string) {
    const hashtag = await this.prisma.hashtag.upsert({
      where: { name },
      create: { name },
      update: { deletedAt: null },
    });
    return { hashtagId: hashtag.id };
  }

  /**
   * hashtags undefined => field absent from the request => leave hashtags as is.
   * hashtags === [] => field explicitly sent empty => clear them.
   */
  async buildHashtagsNestedWrite(
    pollId: number,
    hashtags: PollUpdateDTO['hashtags'],
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
        hashtagsToCreate.map((name) => this.connectOrCreateHashtag(name)),
      ),
      deleteMany: hashtagsToDisconnect,
    };
  }
}
