import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class PresenceService {
  constructor(private users: UsersService) {}

  async setOnline(userId: number): Promise<void> {
    await this.users.setOnline(userId);
  }

  async setOffline(userId: number): Promise<void> {
    await this.users.setOffline(userId);
  }

  async resetAll(): Promise<number> {
    return await this.users.resetOnlineStatus();
  }
}
