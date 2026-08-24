import { FriendshipService } from './friendship.service';

export const friendshipServiceMock = {
  provide: FriendshipService,
  useValue: {},
};
