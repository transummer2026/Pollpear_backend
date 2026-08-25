import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { UserId } from 'src/common/decorators/user-id.decorator';
import {
  SearchQuerySchema,
  type SearchQueryDTO,
} from 'Pollpear_shared/src/schemas/search.schema';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(SearchQuerySchema)) query: SearchQueryDTO,
    @UserId() userId: number,
  ) {
    return this.searchService.search(query, userId);
  }
}
