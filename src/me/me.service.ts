import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';

@Injectable()
export class MeService {
  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }
}
