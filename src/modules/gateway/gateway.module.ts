import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { GatewayController } from './gateway.controller';
import { GatewayUseCases } from './gateway.usecase';

@Module({
  imports: [UserModule],
  controllers: [GatewayController],
  providers: [GatewayUseCases],
})
export class GatewayModule {}
