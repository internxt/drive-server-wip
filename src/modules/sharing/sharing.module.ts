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
    FolderModule,
    UserModule,
    BridgeModule,
    AppSumoModule,
  ],
  controllers: [SharingController],
  providers: [
    SharingService,
    SequelizeSharingRepository,
    SequelizeUserReferralsRepository,
    PaymentsService,
  ],
})
export class SharingModule {}
