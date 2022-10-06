import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FriendInvitationModel } from './shared-workspace.repository';

@Module({
  imports: [SequelizeModule.forFeature([FriendInvitationModel])],
  controllers: [],
  providers: [],
  exports: [],
})
export class SharedWorkspaceModule {}
