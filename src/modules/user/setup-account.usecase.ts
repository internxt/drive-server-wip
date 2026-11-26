import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { type PreCreatedUserCheckoutAttributes } from './pre-created-user-checkout.attributes';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { type PreCreatedUserCheckout } from './pre-created-user-checkout.domain';
import { SequelizePreCreatedUserCheckoutRepository } from './pre-created-user-checkout.repository';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { SequelizeUserRepository } from './user.repository';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PreCreateUserForCheckoutResponseDto } from '../gateway/dto/pre-create-user-for-checkout.dto';
import { PreCreatedUserNotFoundException } from './exception/pre-created-user-not-found.exception';
import { buildAccountSetupUrl } from './account-setup-link';

@Injectable()
export class SetupCheckoutAccountUseCase {
  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly preCreatedUserCheckoutRepository: SequelizePreCreatedUserCheckoutRepository,
    private readonly mailerService: MailerService,
    private readonly networkService: BridgeService,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async getOrCreate(
    rawEmail: PreCreatedUserCheckoutAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const email = rawEmail.toLowerCase();

    const registeredUser = await this.userRepository.findByUsername(email);
    if (registeredUser) {
      throw new ConflictException('User already registered');
    }

    const checkout =
      await this.preCreatedUserCheckoutRepository.findByEmail(email);

    if (checkout?.hasStarted()) {
      return this.toResponse(checkout);
    }

    const { uuid } = await this.networkService.createUser(email);

    if (checkout) {
      await this.preCreatedUserCheckoutRepository.updateByNetworkUuid(
        checkout.networkUuid,
        {
          networkUuid: uuid,
          status: PreCreatedUserStatus.AwaitingPayment,
          tierId: null,
        },
      );

      return { uuid, status: PreCreatedUserStatus.AwaitingPayment };
    }

    return this.createPreCreatedUserCheckout(email, uuid);
  }

  async get(
    rawEmail: PreCreatedUserCheckoutAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const checkout = await this.preCreatedUserCheckoutRepository.findByEmail(
      rawEmail.toLowerCase(),
    );

    if (!checkout) {
      throw new PreCreatedUserNotFoundException();
    }

    return this.toResponse(checkout);
  }

  async sendAccountEmail(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
    planName?: string,
  ): Promise<void> {
    const checkout =
      await this.preCreatedUserCheckoutRepository.findByNetworkUuid(
        networkUuid,
      );

    if (!checkout) {
      const registeredUser = await this.userRepository.findByUuid(networkUuid);
      if (!registeredUser) {
        throw new NotFoundException('User not found');
      }
      return;
    }

    if (!checkout.isAwaitingPayment()) {
      return;
    }

    await this.sendAccountSetupEmail(checkout, planName);
  }

  async update(
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
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
    const checkout =
      await this.preCreatedUserCheckoutRepository.findByNetworkUuid(
        networkUuid,
      );
    if (!checkout) {
      throw new PreCreatedUserNotFoundException();
    }

    const update: Partial<
      Pick<PreCreatedUserCheckoutAttributes, 'tierId' | 'status'>
    > = {};

    if (newTierId !== undefined) {
      const tier = await this.featureLimitService.getTier(newTierId);

      if (!tier) {
        throw new BadRequestException(`Tier with ID ${newTierId} not found`);
      }

      update.tierId = newTierId;
    }

    if (status !== undefined) {
      update.status = status;
    }

    await this.preCreatedUserCheckoutRepository.updateByNetworkUuid(
      networkUuid,
      update,
    );

    if (!newStorageSpaceBytes) {
      return;
    }

    await this.networkService.setStorage(checkout.email, newStorageSpaceBytes);
  }

  private toResponse(
    checkout: PreCreatedUserCheckout,
  ): PreCreateUserForCheckoutResponseDto {
    return {
      uuid: checkout.networkUuid,
      status: checkout.status,
    };
  }

  private async createPreCreatedUserCheckout(
    email: PreCreatedUserCheckoutAttributes['email'],
    networkUuid: PreCreatedUserCheckoutAttributes['networkUuid'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    try {
      const checkout = await this.preCreatedUserCheckoutRepository.create({
        networkUuid,
        email,
        status: PreCreatedUserStatus.AwaitingPayment,
      });

      return this.toResponse(checkout);
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }

      const concurrentPreCreatedUserCheckout =
        await this.preCreatedUserCheckoutRepository.findByEmail(email);

      if (!concurrentPreCreatedUserCheckout) {
        throw error;
      }

      return this.toResponse(concurrentPreCreatedUserCheckout);
    }
  }

  private async sendAccountSetupEmail(
    checkout: PreCreatedUserCheckout,
    planName?: string,
  ): Promise<void> {
    const { networkUuid, email } = checkout;
    const sentAt = new Date();

    const isClaimed =
      await this.preCreatedUserCheckoutRepository.updateByNetworkUuidAndStatus(
        networkUuid,
        PreCreatedUserStatus.AwaitingPayment,
        {
          status: PreCreatedUserStatus.PendingSetup,
          setupEmailSentAt: sentAt,
          setupEmailResendCount: 0,
        },
      );

    if (!isClaimed) {
      return;
    }

    const { setupUrl } = buildAccountSetupUrl(networkUuid, sentAt);

    try {
      await this.mailerService.sendAccountSetupEmail(email, {
        planName,
        setupUrl,
      });
    } catch (error) {
      await this.rollbackSetupEmailSent(checkout);

      throw error;
    }
  }

  private async rollbackSetupEmailSent(
    checkout: PreCreatedUserCheckout,
  ): Promise<void> {
    try {
      await this.preCreatedUserCheckoutRepository.updateByNetworkUuid(
        checkout.networkUuid,
        {
          status: PreCreatedUserStatus.AwaitingPayment,
          setupEmailSentAt: checkout.setupEmailSentAt,
          setupEmailResendCount: checkout.setupEmailResendCount,
        },
      );
    } catch (error) {
      Logger.error(
        { networkUuid: checkout.networkUuid, err: error },
        '[ACCOUNT_SETUP/SEND_EMAIL] Could not roll back the setup email sent',
      );
    }
  }
}
