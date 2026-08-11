import { Injectable, UnauthorizedException } from '@nestjs/common';
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
import { generateApiKey } from './api-key';

const DEFAULT_APP_NAME = 'default';
const API_KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60; // 1 year, in seconds

@Injectable()
export class MeService {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly storageService: StorageService,
    private readonly websocketEmitter: WebsocketEmitter,
    private readonly redis: RedisService,
  ) {}

  // endpoints

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

    return { ...apiKey, key };
  }

  async getApiKey(userId: number) {
    return await this.selectApiKey(userId);
  }

  async revokeApiKey(userId: number) {
    const apiKey = await this.selectActiveKey(userId);
    if (!apiKey) {
      return;
    }
    await this.updateRevoked(apiKey.id);
    await this.redis.deleteApiKey(apiKey.keyHash);
  }

  /**
   * The gateway owns the session store and invalidates it around this
   * call; what is left here is closing the websocket tunnels opened
   */
  async remove(userId: number) {
    const user = await this.updateIsDeleted(userId);
    await this.revokeApiKey(userId);
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
