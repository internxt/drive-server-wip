import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { MailService } from '../../externals/mail/mail.service';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { LimitLabels } from '../feature-limit/limits.enum';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { type User } from '../user/user.domain';
import { type CreateMailAccountDto } from './dto/create-mail-account.dto';

const BLOCKED_RECOVERY_DOMAINS = new Set(['inxt.eu']);

@Injectable()
export class MailUseCases {
  constructor(
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
    @Inject(MailService)
    private readonly mailService: MailService,
    @Inject(SequelizeUserRepository)
    private readonly userRepository: SequelizeUserRepository,
    @Inject(UserUseCases)
    private readonly userUseCases: UserUseCases,
    @Inject(FeatureLimitService)
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async createMailAccount(
    user: User,
    dto: CreateMailAccountDto,
  ): Promise<{ token: string; newToken: string; address: string }> {
    await this.assertMailAccessEnabled(user);
    this.verifyPassword(user, dto.password);
    this.validateRecoveryEmail(user.email);

    const fullAddress = `${dto.address}@${dto.domain}`;

    await this.mailService.createAccount({
      userId: user.uuid,
      address: fullAddress,
      domain: dto.domain,
      displayName: dto.displayName,
    });

    const previousEmail = user.email;

    try {
      await this.userRepository.updateByUuid(user.uuid, {
        email: fullAddress,
        recoveryEmail: previousEmail,
      });
    } catch (error) {
      await this.userRepository.updateByUuid(user.uuid, {
        email: previousEmail,
        recoveryEmail: null,
      });
      throw error;
    }

    const updatedUser = await this.userRepository.findByUuid(user.uuid);

    const { token, newToken } =
      await this.userUseCases.getAuthTokens(updatedUser);

    return { token, newToken, address: fullAddress };
  }

  private verifyPassword(user: User, encryptedPassword: string): void {
    const hashedPass = this.cryptoService.decryptText(encryptedPassword);

    if (hashedPass !== user.password.toString()) {
      throw new UnauthorizedException('Wrong credentials');
    }
  }

  private async assertMailAccessEnabled(user: User): Promise<void> {
    const limit = await this.featureLimitService.getUserLimitByLabel(
      LimitLabels.MailAccess,
      user,
    );

    if (!limit || !limit.isFeatureEnabled()) {
      throw new PaymentRequiredException(
        'Mail access is not available for your current plan',
      );
    }
  }

  private validateRecoveryEmail(currentEmail: string): void {
    const domain = currentEmail.split('@')[1]?.toLowerCase();

    if (BLOCKED_RECOVERY_DOMAINS.has(domain)) {
      throw new BadRequestException(
        'This email domain cannot be used as recovery email',
      );
    }
  }
}
