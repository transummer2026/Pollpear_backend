import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UserDTO,
  UserDTOSchema,
  type UserProfileUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class MeService {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly storageService: StorageService,
  ) {}

  // endpoints

  async myProfile(userId: number): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return UserDTOSchema.parse(user);
  }

  async editProfile(
    userId: number,
    body: UserProfileUpdateDTO,
  ): Promise<UserDTO> {
    const user = await this.updateMyProfile(userId, body);
    return UserDTOSchema.parse(user);
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const image = await this.fileUploadService.processImage(file, 'avatar');
    const key = `avatars/${userId}.webp`;
    await this.storageService.save(key, image, 'image/webp');
    const avatarUrl = `${this.storageService.publicUrl(key)}?v=${Date.now()}`;

    await this.updateAvatar(userId, avatarUrl);
    return { avatarUrl };
  }

  settings() {
    return 'settings route works';
  }

  changePassword() {
    return 'change password route works';
  }

  async remove(userId: number) {
    return await this.updateIsDeleted(userId);
  }

  // Pruisma helpers

  private async updateMyProfile(userId: number, body: UserProfileUpdateDTO) {
    console.log(body.username);
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
