import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayUseCases } from './gateway.usecase';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserModule } from '../user/user.module';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';

@Module({
  imports: [
    WorkspacesModule,
    UserModule,
    CacheManagerModule,
    NotificationModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayUseCases],
})
export class GatewayModule {}
