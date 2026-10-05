import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PreCreatedUserStatus,
  type PreCreatedUserAttributes,
} from './pre-created-users.attributes';
import { UserUseCases } from './user.usecase';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { SequelizeUserRepository } from './user.repository';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PreCreateUserForCheckoutResponseDto } from '../gateway/dto/pre-create-user-for-checkout.dto';
import { type PreCreatedUser } from './pre-created-user.domain';
import { UniqueConstraintError } from 'sequelize';
import { SequelizeSharingRepository } from '../sharing/sharing.repository';
import { SequelizeWorkspaceRepository } from '../workspaces/repositories/workspaces.repository';
import { PreCreatedUserNotFoundException } from './exception/pre-created-user-not-found.exception';
import { buildAccountSetupUrl } from './account-setup-link';

@Injectable()
export class SetupCheckoutAccountUseCase {
  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly preCreatedUserRepository: SequelizePreCreatedUsersRepository,
    private readonly mailerService: MailerService,
    private readonly networkService: BridgeService,
    private readonly userUseCases: UserUseCases,
    private readonly featureLimitService: FeatureLimitService,
    private readonly sharingRepository: SequelizeSharingRepository,
    private readonly workspaceRepository: SequelizeWorkspaceRepository,
  ) {}

  async getOrCreate(
    rawEmail: PreCreatedUserAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const email = rawEmail.toLowerCase();

    const registeredUser = await this.userRepository.findByUsername(email);
    if (registeredUser) {
      throw new ConflictException('User already registered');
    }

    const existentPreCreatedUser =
      await this.preCreatedUserRepository.findByUsername(email);

    if (this.hasCheckoutAlreadyStarted(existentPreCreatedUser)) {
      return {
        uuid: existentPreCreatedUser.uuid,
        status: existentPreCreatedUser.status,
      };
    }

    const { uuid } = await this.networkService.createUser(email);

    if (existentPreCreatedUser) {
      await this.adoptPreCreatedUserForCheckout(existentPreCreatedUser, uuid);

      return { uuid, status: PreCreatedUserStatus.AwaitingPayment };
    }

    return this.preCreateUserForCheckout(email, uuid);
  }

  async get(
    rawEmail: PreCreatedUserAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const preCreatedUser = await this.preCreatedUserRepository.findByUsername(
      rawEmail.toLowerCase(),
    );

    if (!preCreatedUser) {
      throw new PreCreatedUserNotFoundException();
    }

    return {
      uuid: preCreatedUser.uuid,
      status: preCreatedUser.status,
    };
  }

  async sendAccountEmail(
    uuid: PreCreatedUserAttributes['uuid'],
    planName?: string,
  ): Promise<void> {
    const preCreatedUser = await this.preCreatedUserRepository.findByUuid(uuid);

    if (!preCreatedUser) {
      const registeredUser = await this.userRepository.findByUuid(uuid);
      if (!registeredUser) {
        throw new NotFoundException('User not found');
      }
      return;
    }

    if (preCreatedUser.status !== PreCreatedUserStatus.AwaitingPayment) {
      return;
    }

    await this.sendAccountSetupEmail(preCreatedUser, planName);
  }

  async update(
    uuid: string,
    {
      newStorageSpaceBytes,
      newTierId,
      status,
    }: {
      newStorageSpaceBytes?: number;
      newTierId?: string;
      status?: PreCreatedUserStatus;
    },
  ) {
    const updateData: Partial<Omit<PreCreatedUserAttributes, 'id'>> = {};
    const preCreatedUser = await this.preCreatedUserRepository.findByUuid(uuid);
    if (!preCreatedUser) {
      throw new PreCreatedUserNotFoundException();
    }

    if (newTierId !== undefined) {
      const tier = await this.featureLimitService.getTier(newTierId);

      if (!tier) {
        throw new BadRequestException(`Tier with ID ${newTierId} not found`);
      }

      updateData.tierId = newTierId;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    await this.preCreatedUserRepository.updateByUuid(uuid, updateData);

    if (!newStorageSpaceBytes) {
      return;
    }

    await this.networkService.setStorage(
      preCreatedUser.username,
      newStorageSpaceBytes,
    );
  }

  private hasCheckoutAlreadyStarted(
    preCreatedUser: PreCreatedUser | null,
  ): preCreatedUser is PreCreatedUser & {
    status:
      PreCreatedUserStatus.AwaitingPayment | PreCreatedUserStatus.PendingSetup;
  } {
    return (
      preCreatedUser?.status === PreCreatedUserStatus.AwaitingPayment ||
      preCreatedUser?.status === PreCreatedUserStatus.PendingSetup
    );
  }

  private async preCreateUserForCheckout(
    email: PreCreatedUserAttributes['email'],
    uuid: PreCreatedUserAttributes['uuid'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    try {
      const [preCreatedUser] = await this.userUseCases.preCreateUser(
        { email },
        uuid,
        PreCreatedUserStatus.AwaitingPayment,
      );

      return { uuid, status: preCreatedUser.status };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }

      const concurrentPreCreatedUser =
        await this.preCreatedUserRepository.findByUsername(email);

      if (!concurrentPreCreatedUser) {
        throw error;
      }

      return {
        uuid: concurrentPreCreatedUser.uuid,
        status: concurrentPreCreatedUser.status,
      };
    }
  }

  private async adoptPreCreatedUserForCheckout(
    preCreatedUser: PreCreatedUser,
    networkUuid: PreCreatedUserAttributes['uuid'],
  ): Promise<void> {
    if (preCreatedUser.uuid !== networkUuid) {
      await this.reassignPreCreatedUserUuid(preCreatedUser.uuid, networkUuid);
    }

    await this.preCreatedUserRepository.updateByUuid(networkUuid, {
      status: PreCreatedUserStatus.AwaitingPayment,
    });
  }

  private async reassignPreCreatedUserUuid(
    currentUuid: PreCreatedUserAttributes['uuid'],
    newUuid: PreCreatedUserAttributes['uuid'],
  ): Promise<void> {
    await this.sharingRepository.updateAllUserSharedWith(currentUuid, {
      sharedWith: newUuid,
    });
    await this.workspaceRepository.updateInvitesBy(
      { invitedUser: currentUuid },
      { invitedUser: newUuid },
    );
    await this.preCreatedUserRepository.updateByUuid(currentUuid, {
      uuid: newUuid,
    });
  }

  private async sendAccountSetupEmail(
    preCreatedUser: PreCreatedUser,
    planName?: string,
  ): Promise<void> {
    const { uuid, email } = preCreatedUser;
    const sentAt = new Date();

    const isClaimed = await this.preCreatedUserRepository.updateByUuidAndStatus(
      uuid,
      PreCreatedUserStatus.AwaitingPayment,
      { status: PreCreatedUserStatus.PendingSetup, setupEmailSentAt: sentAt },
    );

    if (!isClaimed) {
      return;
    }

    const { setupUrl } = buildAccountSetupUrl(uuid, sentAt);

    try {
      await this.mailerService.sendAccountSetupEmail(email, {
        planName,
        setupUrl,
      });
    } catch (error) {
      await this.rollbackSetupEmailSent(preCreatedUser);

      throw error;
    }
  }

  private async rollbackSetupEmailSent(
    preCreatedUser: PreCreatedUser,
  ): Promise<void> {
    try {
      await this.preCreatedUserRepository.updateByUuid(preCreatedUser.uuid, {
        status: PreCreatedUserStatus.AwaitingPayment,
        setupEmailSentAt: preCreatedUser.setupEmailSentAt,
      });
    } catch (releaseError) {
      Logger.error(
        `[ACCOUNT_SETUP/SEND_EMAIL] Could not roll back the setup email sent to pre-created user ${preCreatedUser.uuid}: ${(releaseError as Error).message}`,
      );
    }
  }
}
