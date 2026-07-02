import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiKeysService {
  create() {
    return 'This action adds a new key';
  }

  findAll() {
    return `This action returns all keys`;
  }

  findOne(id: number) {
    return `This action returns a #${id} key`;
  }

  update(id: number) {
    return `This action updates a #${id} key`;
  }

  remove(id: number) {
    return `This action removes a #${id} key`;
  }
}
