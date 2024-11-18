import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayUseCases } from './gateway.usecase';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [WorkspacesModule, UserModule],
  controllers: [GatewayController],
  providers: [GatewayUseCases],
})
export class GatewayModule {}
