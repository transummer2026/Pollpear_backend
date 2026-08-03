import { ForbiddenError, subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory/casl-ability.factory';

@Injectable()
export class PollsService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}
  create() {
    return 'add new poll route works';
  }

  async update(id: number, userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const poll = await this.prisma.poll.findUniqueOrThrow({ where: { id } });

    const ability = this.abilityFactory.createForUser(user);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Poll', poll),
    );

    return `update work #${id}`;
  }

  remove(id: number) {
    return `remove poll #${id} works`;
  }

  report(id: number) {
    return `report Poll #${id} works`;
  }

  reportOption(id: number, optionId: number) {
    return `report option #${optionId} for Poll #${id} works`;
  }

  removeOption(id: number, optionId: number) {
    return `remove option #${optionId} for Poll #${id} works`;
  }

  createVote(id: number) {
    return `create vote in Poll #${id} works`;
  }

  updateVote(id: number) {
    return `update vote in Poll ${id}`;
  }

  removeVote(id: number) {
    return `remove vote in Poll #${id} works`;
  }

  reportVote(id: number) {
    return `report vote in Poll #${id} works`;
  }
}
