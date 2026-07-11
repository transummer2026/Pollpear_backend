import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UserDTO,
  UserDTOSchema,
} from 'Pollpear_shared/src/schemas/users.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class MeService {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UsersService,
  ) {}

  async myProfile(userId: string): Promise<UserDTO> {
    const user = await this.userService.findByUserId(userId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return UserDTOSchema.parse(user);
  }

  update(id: number) {
    return `This action updates a #${id} user`;
  }

  editProfile() {
    return 'my editProfile route works';
  }

  uploadAvatar() {
    return 'upload avatar route works';
  }

  settings() {
    return 'settings route works';
  }

  changePassword() {
    return 'change password route works';
  }

  remove() {
    return `This action removes a profile`;
  }
}
