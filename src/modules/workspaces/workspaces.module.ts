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
import { PaymentsService } from '../../externals/payments/payments.service';
import { HttpClientModule } from '../../externals/http/http.module';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { FuzzySearchUseCases } from '../fuzzy-search/fuzzy-search.usecase';
import { FuzzySearchModule } from '../fuzzy-search/fuzzy-search.module';
import { NotificationModule } from '../../externals/notifications/notifications.module';
import { WorkspaceLogModel } from './models/workspace-logs.model';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { TrashModel } from '../trash/trash.model';
import { SequelizeTrashRepository } from '../trash/trash.repository';

@Module({
  imports: [
    SequelizeModule.forFeature([
      WorkspaceModel,
      WorkspaceItemUserModel,
      WorkspaceTeamModel,
      WorkspaceTeamUserModel,
      WorkspaceUserModel,
      WorkspaceInviteModel,
      WorkspaceLogModel,
      TrashModel,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => FolderModule),
    forwardRef(() => FileModule),
    forwardRef(() => SharingModule),
    CryptoModule,
    BridgeModule,
    MailerModule,
    HttpClientModule,
    FuzzySearchModule,
    NotificationModule,
    forwardRef(() => FeatureLimitModule),
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
    FuzzySearchUseCases,
    SequelizeTrashRepository,
  ],
  exports: [WorkspacesUsecases, SequelizeModule, SequelizeWorkspaceRepository],
})
export class WorkspacesModule {}
