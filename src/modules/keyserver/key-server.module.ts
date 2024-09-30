import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeKeyServerRepository } from './key-server.repository';
import { KeyServerUseCases } from './key-server.usecase';
import { KeyServerModel } from './key-server.model';

@Module({
  imports: [SequelizeModule.forFeature([KeyServerModel])],
  providers: [KeyServerUseCases, SequelizeKeyServerRepository],
  exports: [KeyServerUseCases, SequelizeKeyServerRepository],
})
export class KeyServerModule {}
