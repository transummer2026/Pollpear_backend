// src/api/v1/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { ApiAdminStaffService } from './staff/staff.service';
import { ApiAdminStaffController } from './staff/staff.controller';
import { ApiAdminUserService } from './users/users.service';
import { ApiAdminUserController } from './users/users.controller';
import { MeModule } from 'src/me/me.module';

/**
 * Both controllers are declared here rather than in nested modules:
 * deepScanRoutes only walks one level below the modules listed in the
 * swagger include, so a nested module would serve its routes but never
 * document them.
 */
@Module({
  imports: [MeModule],
  controllers: [ApiAdminStaffController, ApiAdminUserController],
  providers: [ApiAdminStaffService, ApiAdminUserService],
})
export class ApiAdminModule {}
