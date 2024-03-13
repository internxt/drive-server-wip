import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { UserModule } from '../user/user.module';
import { ShareModule } from '../share/share.module';
import { ShareModel } from '../share/share.repository';
import { FileModel } from '../file/file.model';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceModel } from './models/workspace.model';
import { WorkspaceItemUserModel } from './models/workspace-items-users.model';
import { TeamModel } from './models/team.model';
import { TeamUserModel } from './models/team-users.model';
import { WorkspaceUserModel } from './models/workspace-users.model';
import { SequelizeTeamsRepository } from './repositories/teams.repository';
import { WorkspacesUsecases } from './workspaces.usecase';
import { SequelizeWorkspacesRepository } from './repositories/workspaces.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([
      FileModel,
      ShareModel,
      WorkspaceModel,
      WorkspaceItemUserModel,
      TeamModel,
      TeamUserModel,
      WorkspaceUserModel,
    ]),
    forwardRef(() => FileModule),
    forwardRef(() => ShareModule),
    FolderModule,
    NotificationModule,
    UserModule,
    ShareModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    Logger,
    WorkspacesUsecases,
    SequelizeTeamsRepository,
    SequelizeWorkspacesRepository,
  ],
  exports: [WorkspacesUsecases, SequelizeModule],
})
export class WorkspacesModule {}
