import { Injectable } from '@nestjs/common';

@Injectable()
export class MeService {
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
