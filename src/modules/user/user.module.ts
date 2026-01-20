import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { SequelizeUserRepository } from './user.repository';
import { UserUseCases } from './user.usecase';
import { UserModel } from './user.model';
import {
  FriendInvitationModel,
  SequelizeSharedWorkspaceRepository,
} from '../../shared-workspace/shared-workspace.repository';
import {
  SequelizeUserReferralsRepository,
  UserReferralModel,
} from './user-referrals.repository';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { NotificationService } from '../../externals/notifications/notification.service';
import {
  ReferralModel,
  SequelizeReferralRepository,
} from './referrals.repository';
import { FolderModule } from '../folder/folder.module';
import { FileModule } from '../file/file.module';
import { HttpClientModule } from '../../externals/http/http.module';
import { UserController } from './user.controller';
import { PaymentsService } from '../../externals/payments/payments.service';
import { NewsletterService } from '../../externals/newsletter';
import { KeyServerModule } from '../keyserver/key-server.module';
import { SequelizeKeyServerRepository } from '../keyserver/key-server.repository';
import { CryptoModule } from '../../externals/crypto/crypto.module';
import { SharedWorkspaceModule } from '../../shared-workspace/shared-workspace.module';
import { ShareModule } from '../share/share.module';
import { KeyServerModel } from '../keyserver/key-server.model';
import { AvatarService } from '../../externals/avatar/avatar.service';
import { AppSumoModule } from '../app-sumo/app-sumo.module';
import { PlanModule } from '../plan/plan.module';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { PreCreatedUserModel } from './pre-created-users.model';
import { SharingModule } from '../sharing/sharing.module';
import { SequelizeAttemptChangeEmailRepository } from './attempt-change-email.repository';
import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { MailerService } from '../../externals/mailer/mailer.service';
import { SecurityModule } from '../security/security.module';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { UserNotificationTokensModel } from './user-notification-tokens.model';
import { BackupModule } from '../backups/backup.module';
import { CacheManagerModule } from '../cache-manager/cache-manager.module';
import { AsymmetricEncryptionModule } from '../../externals/asymmetric-encryption/asymmetric-encryption.module';
import { AuditLogsModule } from '../../common/audit-logs/audit-logs.module';
import { KlaviyoModule } from '../..//externals/klaviyo/klaviyo.module';
import { CaptchaService } from '../../externals/captcha/captcha.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserModel,
      PreCreatedUserModel,
      ReferralModel,
      UserReferralModel,
      FriendInvitationModel,
      KeyServerModel,
      AttemptChangeEmailModel,
      UserNotificationTokensModel,
    ]),
    forwardRef(() => FolderModule),
    forwardRef(() => FileModule),
    SharedWorkspaceModule,
    HttpClientModule,
    KeyServerModule,
    CryptoModule,
    forwardRef(() => ShareModule),
    BridgeModule,
    AppSumoModule,
    PlanModule,
    forwardRef(() => SharingModule),
    SecurityModule,
    forwardRef(() => FeatureLimitModule),
    forwardRef(() => WorkspacesModule),
    forwardRef(() => BackupModule),
    CacheManagerModule,
    AsymmetricEncryptionModule,
    AuditLogsModule,
    KlaviyoModule,
  ],
  controllers: [UserController],
  providers: [
    SequelizeUserRepository,
    SequelizePreCreatedUsersRepository,
    SequelizeSharedWorkspaceRepository,
    SequelizeReferralRepository,
    SequelizeKeyServerRepository,
    SequelizeUserReferralsRepository,
    SequelizeAttemptChangeEmailRepository,
    SequelizeWorkspaceRepository,
    UserUseCases,
    CryptoService,
    BridgeService,
    NotificationService,
    PaymentsService,
    NewsletterService,
    AvatarService,
    MailerService,
    CaptchaService
  ],
  exports: [
    UserUseCases,
    SequelizeUserRepository,
    SequelizeUserReferralsRepository,
    SequelizeReferralRepository,
    SequelizeAttemptChangeEmailRepository,
  ],
})
export class UserModule {}
