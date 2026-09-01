import type { ApiIndexDTO } from './schemas/api-index.schema';

export const apiV1: ApiIndexDTO = {
  version: 'v1',
  docs: '/api/v1/docs',
  resources: ['me', 'users', 'polls', 'rooms', 'friendships'],
};
