import { Controller, Get, HttpCode } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  // will need to return a search DTO relative to the thing being searched
  @Get()
  @HttpCode(503)
  search() {
    return this.searchService.search();
  }
}
