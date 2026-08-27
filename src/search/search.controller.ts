import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
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
    @CurrentUser() viewer: User,
  ) {
    return this.searchService.search(query, viewer);
  }
}
