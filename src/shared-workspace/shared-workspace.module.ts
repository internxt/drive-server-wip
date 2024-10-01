import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  FriendInvitationModel,
  SequelizeSharedWorkspaceRepository,
} from './shared-workspace.repository';

@Module({
  imports: [SequelizeModule.forFeature([FriendInvitationModel])],
  controllers: [],
  providers: [SequelizeSharedWorkspaceRepository],
  exports: [SequelizeSharedWorkspaceRepository],
})
export class SharedWorkspaceModule {}
