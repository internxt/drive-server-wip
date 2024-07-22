import { Logger, Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserModule } from '../user/user.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceModel } from './models/workspace.model';
import { WorkspaceItemUserModel } from './models/workspace-items-users.model';
import { WorkspaceUserModel } from './models/workspace-users.model';
import { WorkspacesUsecases } from './workspaces.usecase';
import { SequelizeWorkspaceRepository } from './repositories/workspaces.repository';
import { SequelizeWorkspaceTeamRepository } from './repositories/team.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { WorkspaceTeamModel } from './models/workspace-team.model';
import { WorkspaceTeamUserModel } from './models/workspace-team-users.model';
import { WorkspaceGuard } from './guards/workspaces.guard';
import { WorkspaceInviteModel } from './models/workspace-invite.model';
import { MailerModule } from '../../externals/mailer/mailer.module';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { FolderModule } from '../folder/folder.module';
import { FileModule } from '../file/file.module';
import { SharingModule } from '../sharing/sharing.module';
import { PaymentsService } from 'src/externals/payments/payments.service';
import { HttpClientModule } from 'src/externals/http/http.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      WorkspaceModel,
      WorkspaceItemUserModel,
      WorkspaceTeamModel,
      WorkspaceTeamUserModel,
      WorkspaceUserModel,
      WorkspaceInviteModel,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => FolderModule),
    forwardRef(() => FileModule),
    forwardRef(() => SharingModule),
    BridgeModule,
    MailerModule,
    HttpClientModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    Logger,
    WorkspacesUsecases,
    SequelizeWorkspaceTeamRepository,
    SequelizeWorkspaceRepository,
    WorkspaceGuard,
    AvatarService,
    PaymentsService,
  ],
  exports: [WorkspacesUsecases, SequelizeModule],
})
export class WorkspacesModule {}
