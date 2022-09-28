import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeUserRepository } from './user.repository';
import { UserUseCases } from './user.usecase';
import { UserModel } from './user.repository';
import {
  FriendInvitationModel,
  SequelizeSharedWorkspaceRepository,
} from 'src/shared-workspace/shared-workspace.repository';
import {
  SequelizeUserReferralsRepository,
  UserReferralModel,
} from './user-referrals.repository';
import { FolderUseCases } from '../folder/folder.usecase';
import { CryptoService } from 'src/externals/crypto/crypto';
import { BridgeService } from 'src/externals/bridge/bridge.service';
import { NotificationService } from 'src/externals/notifications/notification.service';
import {
  ReferralModel,
  SequelizeReferralRepository,
} from './referrals.repository';
import { FolderModule } from '../folder/folder.module';
import { FileModule } from '../file/file.module';
import { HttpClientModule } from 'src/externals/http/http.module';
import { UserController } from './user.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      UserModel,
      ReferralModel,
      UserReferralModel,
      FriendInvitationModel,
    ]),
    FolderModule,
    forwardRef(() => FileModule),
    HttpClientModule,
  ],
  controllers: [UserController],
  providers: [
    SequelizeUserRepository,
    SequelizeSharedWorkspaceRepository,
    SequelizeReferralRepository,
    SequelizeUserReferralsRepository,
    UserUseCases,
    FolderUseCases,
    CryptoService,
    BridgeService,
    NotificationService,
  ],
  exports: [UserUseCases],
})
export class UserModule {}
