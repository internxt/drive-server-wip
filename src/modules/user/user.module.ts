import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
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
import { FolderUseCases } from '../folder/folder.usecase';
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
import { ShareModule } from '../share/share.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserModel,
      ReferralModel,
      UserReferralModel,
      FriendInvitationModel,
    ]),
    forwardRef(() => FolderModule),
    forwardRef(() => FileModule),
    HttpClientModule,
    KeyServerModule,
    forwardRef(() => ShareModule),
  ],
  controllers: [UserController],
  providers: [
    SequelizeUserRepository,
    SequelizeSharedWorkspaceRepository,
    SequelizeReferralRepository,
    SequelizeUserReferralsRepository,
    UserUseCases,
    CryptoService,
    BridgeService,
    NotificationService,
    PaymentsService,
    NewsletterService,
  ],
  exports: [UserUseCases, SequelizeUserRepository],
})
export class UserModule {}
