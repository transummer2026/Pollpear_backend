import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchService {
  search() {
    return `search route works`;
  }
}
