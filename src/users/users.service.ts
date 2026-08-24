import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import {
  type UserDTO,
  UserSchema,
  type UserPublicProfileDTO,
  UserPublicProfileSchema,
  type UserUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { ForbiddenError, subject } from '@casl/ability';

const SEARCH_RESULTS_LIMIT = 5;
const SEARCH_SELECT = {
  id: true,
  username: true,
  name: true,
  surname: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Prefix matches on username rank first (the "find that exact friend"
   * case), then contains matches on username/name/surname fill the rest:
   * Prisma has no relevance-ordered ORDER BY without raw SQL.
   */
  async search(q: string) {
    const startsWith = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        visibility: { not: 'private' },
        username: { startsWith: q, mode: 'insensitive' },
      },
      select: SEARCH_SELECT,
      orderBy: { username: 'asc' },
      take: SEARCH_RESULTS_LIMIT,
    });

    const remaining = SEARCH_RESULTS_LIMIT - startsWith.length;
    if (remaining <= 0) return startsWith;

    const contains = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        visibility: { not: 'private' },
        id: { notIn: startsWith.map((user) => user.id) },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { surname: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: SEARCH_SELECT,
      orderBy: { username: 'asc' },
      take: remaining,
    });

    return [...startsWith, ...contains];
  }

  async findOne(id: number): Promise<UserPublicProfileDTO> {
    const user = await this.findByUserId(id);
    if (!user) throw new NotFoundException('User not found');
    return UserPublicProfileSchema.parse(user);
  }

  report(id: number) {
    return `report user #${id} works`;
  }

  private async abilityFor(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    });
    return this.abilityFactory.createForUser(user);
  }

  async update(
    id: number,
    userId: number,
    body: UserUpdateDTO,
  ): Promise<UserDTO> {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const ability = await this.abilityFor(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('User', target),
    );

    const updatedUser = await this.updateUserProfile(id, body);
    return UserSchema.parse(updatedUser);
  }

  remove(id: number) {
    return `remove user #${id} works`;
  }

  // PRISMA REQUESTS

  async findByUserId(userId: number) {
    if (isNaN(userId)) throw new ForbiddenException('Invalid user id.');
    return await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  generateSessionId() {
    return randomUUID();
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async verifyEmail(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  async setOnline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true },
    });
  }

  async setOffline(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });
  }

  async resetOnlineStatus(): Promise<number> {
    const { count } = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    return count;
  }

  private async updateUserProfile(userId: number, data: UserUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: data,
    });
  }
}
