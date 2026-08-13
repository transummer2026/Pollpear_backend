import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UserDTO,
  UserSchema,
  type UserProfileUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UsersService } from 'src/users/users.service';
import { WebsocketEmitter } from 'src/websocket/websocket.emitter';
import { ApiKeyService } from 'src/api-key/api-key.service';

@Injectable()
export class MeService {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly storageService: StorageService,
    private readonly websocketEmitter: WebsocketEmitter,
    private readonly apiKeyService: ApiKeyService,
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

  /**
   * The gateway owns the session store and invalidates it around this
   * call; what is left here is closing the websocket tunnels opened
   * with those sessions, and revoking the api keys it never knew about.
   */
  async remove(userId: number) {
    const user = await this.updateIsDeleted(userId);
    await this.apiKeyService.revokeAll(userId);
    await this.websocketEmitter.revokeUser(userId);
    return user;
  }

  // Prisma helpers

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
