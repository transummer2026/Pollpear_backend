import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  UserDTO,
  UserSchema,
  type UserProfileUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { StorageService } from 'src/storage/storage.service';
import { UsersService } from 'src/users/users.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { fingerprint, generateApiKey } from './api-key';

const DEFAULT_APP_NAME = 'default';
const API_KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60; // 1 year, in seconds

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly storageService: StorageService,
    private readonly websocketEmitter: WebsocketEmitter,
    private readonly redis: RedisService,
  ) {}

  async myProfile(userId: number): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return UserSchema.parse(user);
  }

  async editProfile(
    userId: number,
    body: UserProfileUpdateDTO,
  ): Promise<UserDTO> {
    const updatedUser = await this.updateMyProfile(userId, body);
    return UserSchema.parse(updatedUser);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const image = await this.fileUploadService.processImage(file, 'avatar');
    const key = `avatars/${userId}.webp`;
    await this.storageService.save(key, image, 'image/webp');
    const avatarUrl = `${this.storageService.publicUrl(key)}?v=${Date.now()}`;

    const updatedUser = await this.updateAvatar(userId, avatarUrl);
    return UserSchema.parse(updatedUser);
  }

  settings() {
    return 'settings route works';
  }

  changePassword() {
    return 'change password route works';
  }

  async createApiKey(userId: number, appName?: string) {
    const { key, keyHash } = generateApiKey();
    const ttl = API_KEY_LIFETIME_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await this.revokeApiKey(userId);
    const apiKey = await this.insertApiKey(userId, keyHash, expiresAt, appName);
    await this.redis.setApiKey(keyHash, userId, ttl);

    this.logger.log(
      `api key ${apiKey.id} issued to user ${userId} as "${apiKey.appName}" ` +
        `(${fingerprint(keyHash)}), expires ${expiresAt.toISOString()}`,
    );
    return { ...apiKey, key };
  }

  async getApiKey(userId: number) {
    return await this.selectApiKey(userId);
  }

  async updateApiKey(userId: number, appName: string) {
    const apiKey = await this.selectActiveKey(userId);
    if (!apiKey) {
      this.logger.warn(`user ${userId} tried to rename a key it has not`);
      throw new NotFoundException('No active api key');
    }

    this.logger.log(
      `api key ${apiKey.id} of user ${userId} renamed "${appName}"`,
    );
    return await this.updateAppName(apiKey.id, appName);
  }

  async revokeApiKey(userId: number) {
    const apiKey = await this.selectActiveKey(userId);
    if (!apiKey) {
      return;
    }
    await this.updateRevoked(apiKey.id);
    await this.redis.deleteApiKey(apiKey.keyHash);
    this.logger.log(
      `api key ${apiKey.id} of user ${userId} revoked ` +
        `(${fingerprint(apiKey.keyHash)}), dropped from postgres and redis`,
    );
  }

  async apiKeyBan(userId: number) {
    const apiKeys = await this.selectActiveKeys(userId);
    if (apiKeys.length === 0) {
      return;
    }
    await this.updateAllRevoked(userId);
    await this.redis.deleteApiKeys(apiKeys.map((apiKey) => apiKey.keyHash));
    this.logger.warn(
      `api key ban on user ${userId}: ${apiKeys.length} key(s) revoked ` +
        `(${apiKeys.map((apiKey) => fingerprint(apiKey.keyHash)).join(', ')})`,
    );
  }

  /**
   * The gateway owns the session store and invalidates it around this
   * call; what is left here is closing the websocket tunnels opened
   */
  async remove(userId: number) {
    const user = await this.updateIsDeleted(userId);
    await this.apiKeyBan(userId);
    await this.websocketEmitter.revokeUser(userId);
    return user;
  }

  // Prisma helpers

  private async insertApiKey(
    userId: number,
    keyHash: string,
    expiresAt: Date,
    appName?: string,
  ) {
    return await this.prisma.apiKey.create({
      data: {
        keyHash,
        ownerId: userId,
        expiresAt,
        appName: appName ?? DEFAULT_APP_NAME,
      },
      select: {
        appName: true,
        id: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  private async selectApiKey(userId: number) {
    return await this.prisma.apiKey.findFirst({
      where: {
        ownerId: userId,
        revoked: false,
      },
      select: {
        id: true,
        appName: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  private async selectActiveKey(userId: number) {
    return await this.prisma.apiKey.findFirst({
      where: {
        ownerId: userId,
        revoked: false,
      },
      select: {
        id: true,
        keyHash: true,
      },
    });
  }

  private async updateAppName(keyId: number, appName: string) {
    return await this.prisma.apiKey.update({
      where: {
        id: keyId,
      },
      data: {
        appName,
      },
      select: {
        id: true,
        appName: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  private async selectActiveKeys(userId: number) {
    return await this.prisma.apiKey.findMany({
      where: {
        ownerId: userId,
        revoked: false,
      },
      select: {
        keyHash: true,
      },
    });
  }

  private async updateAllRevoked(userId: number) {
    return await this.prisma.apiKey.updateMany({
      where: {
        ownerId: userId,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
  }

  private async updateRevoked(keyId: number) {
    return await this.prisma.apiKey.update({
      where: {
        id: keyId,
      },
      data: {
        revoked: true,
      },
    });
  }

  private async updateMyProfile(userId: number, body: UserProfileUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        username: body.username,
        email: body.email,
        birthdate: body.birthdate,
        gender: body.gender,
        nationality: body.nationality,
        name: body.name,
        surname: body.surname,
        city: body.city,
        state: body.state,
        country: body.country,
        company: body.company,
        bio: body.bio,
        userTheme: body.userTheme,
      },
    });
  }

  private async updateIsDeleted(userId: number) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  private async updateAvatar(userId: number, uploadImage: string) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: uploadImage,
      },
    });
  }
}
