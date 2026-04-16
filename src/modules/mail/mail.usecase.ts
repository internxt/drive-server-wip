import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { MailService } from '../../externals/mail/mail.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { LimitLabels } from '../feature-limit/limits.enum';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { type User } from '../user/user.domain';
import { type CreateMailAccountDto } from './dto/create-mail-account.dto';

@Injectable()
export class MailUseCases {
  constructor(
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
    @Inject(MailService)
    private readonly mailService: MailService,
    @Inject(FeatureLimitService)
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  async createMailAccount(
    user: User,
    dto: CreateMailAccountDto,
  ): Promise<{ address: string }> {
    await this.assertMailAccessEnabled(user);
    this.verifyPassword(user, dto.password);

    const fullAddress = `${dto.address}@${dto.domain}`;

    await this.mailService.createAccount({
      userId: user.uuid,
      address: fullAddress,
      domain: dto.domain,
      displayName: dto.displayName,
    });

    return { address: fullAddress };
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
}
