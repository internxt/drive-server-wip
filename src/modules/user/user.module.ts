import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeUserRepository } from './user.repository';
import { UserService } from './user.usecase';
import { UserModel } from './user.repository';

@Module({
  imports: [SequelizeModule.forFeature([UserModel])],
  controllers: [],
  providers: [SequelizeUserRepository, UserService],
  exports: [UserService],
})
export class UserModule {}
