import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private readonly prismaservice: PrismaService) {}
  myProfile(userId: string) {
    return this.prismaservice.user.findUnique({
      where: { id: Number(userId) },
    });
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
