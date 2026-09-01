import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UserDTO,
  UserSchema,
  type UserUpdateDTO,
} from 'Pollpear_shared/src/schemas/users.schema';
import { AvatarService } from 'src/file-upload/avatar.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RevocationService } from 'src/revocation/revocation.service';
import type { UserChangePasswordDTO } from 'Pollpear_shared/src/schemas/auth.schema';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class MeService {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly avatarService: AvatarService,
    private readonly authService: AuthService,
    private readonly revocationService: RevocationService,
  ) {}

  async myProfile(userId: number): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return UserSchema.parse(user);
  }

  async editProfile(userId: number, body: UserUpdateDTO): Promise<UserDTO> {
    const updatedUser = await this.updateMyProfile(userId, body);
    return UserSchema.parse(updatedUser);
  }

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const updatedUser = await this.avatarService.replace(userId, file);
    return UserSchema.parse(updatedUser);
  }

  async changePassword(userId: number, body: UserChangePasswordDTO) {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.authService.verifyPassword(user, body.oldPassword);
    const newPasswordHash = await this.authService.hashPassword(body.password);
    await this.updatePassword(userId, newPasswordHash);
    await this.revocationService.revokeAllSessions(userId);
  }

  async remove(userId: number) {
    await this.revocationService.revokeAllAccess(userId);
    return await this.updateDeletedAt(userId);
  }

  private async updateMyProfile(userId: number, body: UserUpdateDTO) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: body,
    });
  }

  private async updateDeletedAt(userId: number) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private async updatePassword(userId: number, newPasswordHash: string) {
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });
  }
}
