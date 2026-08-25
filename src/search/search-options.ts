import type { SearchSort } from 'Pollpear_shared/src/schemas/search.schema';

export const SEARCH_RESULTS_LIMIT = 5;

export type SearchOptions = {
  page?: number;
  limit?: number;
  sortBy?: SearchSort;
};
