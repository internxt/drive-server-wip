import { Module, forwardRef } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { SequelizeSharingRepository } from './sharing.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  PermissionModel,
  RoleModel,
  SharingInviteModel,
  SharingModel,
} from './models';
import { FileModule } from '../file/file.module';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';
import { SharingRolesModel } from './models/sharing-roles.model';
import {
  SequelizeUserReferralsRepository,
  UserReferralModel,
} from '../user/user-referrals.repository';
import { BridgeModule } from '../../externals/bridge/bridge.module';
import { PaymentsService } from '../../externals/payments/payments.service';
import { AppSumoModule } from '../app-sumo/app-sumo.module';
import { FeatureLimitModule } from '../feature-limit/feature-limit.module';
import { HttpClientModule } from '../../externals/http/http.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CaptchaService } from '../../externals/captcha/captcha.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PermissionModel,
      RoleModel,
      SharingRolesModel,
      SharingModel,
      SharingInviteModel,
      UserReferralModel,
    ]),
    forwardRef(() => FileModule),
    forwardRef(() => FolderModule),
    forwardRef(() => WorkspacesModule),
    BridgeModule,
    AppSumoModule,
    forwardRef(() => UserModule),
    forwardRef(() => FeatureLimitModule),
    HttpClientModule,
  ],
  controllers: [SharingController],
  providers: [
    SharingService,
    SequelizeSharingRepository,
    SequelizeUserReferralsRepository,
    PaymentsService,
    CaptchaService
  ],
  exports: [SharingService, SequelizeSharingRepository, SequelizeModule],
})
export class SharingModule {}
