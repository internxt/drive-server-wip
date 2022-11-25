import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  KeyServerModel,
  SequelizeKeyServerRepository,
} from './key-server.repository';
import { KeyServerUseCases } from './key-server.usecase';

@Module({
  imports: [SequelizeModule.forFeature([KeyServerModel])],
  providers: [
    KeyServerUseCases,
    {
      provide: 'KEY_SERVER_REPOSITORY',
      useClass: SequelizeKeyServerRepository,
    },
  ],
  exports: [KeyServerUseCases],
})
export class KeyServerModule {}
