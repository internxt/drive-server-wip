import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeUserRepository } from './user.repository';
import { User } from './user.model';
import { UserService } from './user.service';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [],
  providers: [SequelizeUserRepository, UserService],
  exports: [UserService],
})
export class UserModule {}
