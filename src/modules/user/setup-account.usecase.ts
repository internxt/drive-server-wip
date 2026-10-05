import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PreCreatedUserStatus,
  type PreCreatedUserAttributes,
} from './pre-created-users.attributes';
import {
  buildAccountSetupUrl,
  signAccountSetupToken,
} from './account-setup-token';
import { UserUseCases } from './user.usecase';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { SequelizePreCreatedUsersRepository } from './pre-created-users.repository';
import { SequelizeUserRepository } from './user.repository';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PreCreateUserForCheckoutResponseDto } from '../gateway/dto/pre-create-user-for-checkout.dto';
import { UserNotFoundException } from './exception/user-not-found.exception';

@Injectable()
export class SetupAccountUseCase {
  constructor(
    private readonly userRepository: SequelizeUserRepository,
    private readonly preCreatedUserRepository: SequelizePreCreatedUsersRepository,
    private readonly mailerService: MailerService,
    private readonly networkService: BridgeService,
    private readonly userUseCases: UserUseCases,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async createPreCreateUserForCheckout(
    rawEmail: PreCreatedUserAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const email = rawEmail.toLowerCase();

    const registeredUser = await this.userRepository.findByUsername(email);
    if (registeredUser) {
      throw new ConflictException('User already registered');
    }

    const existentPreCreatedUser =
      await this.preCreatedUserRepository.findByUsername(email);

    if (existentPreCreatedUser) {
      throw new ConflictException('User already registered');
    }

    const { uuid } = await this.networkService.createUser(email);
    const preCreatedUser = await this.userUseCases.preCreateUser(
      { email, status: PreCreatedUserStatus.AwaitingPayment },
      uuid,
    );

    return {
      uuid,
      status: preCreatedUser[0].status,
    };
  }

  async getPreCreatedUser(
    rawEmail: PreCreatedUserAttributes['email'],
  ): Promise<PreCreateUserForCheckoutResponseDto> {
    const preCreatedUser = await this.preCreatedUserRepository.findByUsername(
      rawEmail.toLowerCase(),
    );

    if (!preCreatedUser) {
      throw new UserNotFoundException('Pre-created user not found');
    }

    return {
      uuid: preCreatedUser.uuid,
      status: preCreatedUser.status,
    };
  }

  async sendFirstAccountSetupEmail(
    uuid: PreCreatedUserAttributes['uuid'],
    planName: string,
  ): Promise<void> {
    const preCreatedUser = await this.preCreatedUserRepository.findByUuid(uuid);

    if (!preCreatedUser) {
      const registeredUser = await this.userRepository.findByUuid(uuid);
      if (!registeredUser) {
        throw new NotFoundException('User not found');
      }
      return;
    }

    const isSetupEmailAlreadySent =
      preCreatedUser.status === PreCreatedUserStatus.PendingSetup;
    if (!isSetupEmailAlreadySent) {
      await this.sendAccountSetupEmail(preCreatedUser.email, uuid, planName);
    }
  }

  async updatePreCreatedUserForCheckout(
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
      throw new UserNotFoundException('Pre-created user not found');
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

  private async sendAccountSetupEmail(
    email: PreCreatedUserAttributes['email'],
    uuid: PreCreatedUserAttributes['uuid'],
    planName: string,
  ): Promise<void> {
    const sentAt = new Date();
    const token = signAccountSetupToken(uuid, sentAt);

    await this.mailerService.sendAccountSetupEmail(email, {
      planName,
      setupUrl: buildAccountSetupUrl(token),
    });
    await this.preCreatedUserRepository.updateByUuid(uuid, {
      setupEmailSentAt: sentAt,
      status: PreCreatedUserStatus.PendingSetup,
    });
  }
}
