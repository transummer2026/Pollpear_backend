import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';

@Injectable()
export class MeService {
  update(id: number, updateUserDto: UpdateUserDto) {
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
