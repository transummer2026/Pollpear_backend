import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiHashtagsService {
  findAllHashtags() {
    return 'Get all hashtags - not implemented';
  }

  findOneHashtag(id: number) {
    return `Get hashtag ${id} - not implemented`;
  }
}
