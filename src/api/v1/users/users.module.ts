import { Module } from '@nestjs/common';
import { ApiUsersService } from './users.service';
import { ApiUsersController } from './users.controller';
import { ApiUserProfileService } from './profile/profile.service';
import { ApiUserProfileController } from './profile/profile.controller';

/**
 * The item controller is declared here rather than in its own module:
 * deepScanRoutes only walks one level below the modules listed in the
 * swagger include, so a nested module would serve its route but never
 * document it.
 */
@Module({
  controllers: [ApiUsersController, ApiUserProfileController],
  providers: [ApiUsersService, ApiUserProfileService],
})
export class ApiUsersModule {}
