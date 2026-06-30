import { Injectable } from '@nestjs/common';

@Injectable()
export class FeedService {
  feed() {
    return 'feed route works';
  }
}
