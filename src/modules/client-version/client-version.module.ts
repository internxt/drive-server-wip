import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ClientVersionPolicyModel } from './client-version-policy.model';
import {
  ClientVersionPolicyRepository,
  SequelizeClientVersionPolicyRepository,
} from './client-version-policy.repository';
import { ClientVersionController } from './client-version.controller';
import { ClientVersionUseCase } from './client-version.usecase';

@Module({
  imports: [SequelizeModule.forFeature([ClientVersionPolicyModel])],
  controllers: [ClientVersionController],
  providers: [
    {
      provide: ClientVersionPolicyRepository,
      useClass: SequelizeClientVersionPolicyRepository,
    },
    ClientVersionUseCase,
  ],
  exports: [ClientVersionUseCase],
})
export class ClientVersionModule {}
