import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { type User } from '../user/user.domain';
import { ReferralService } from './referral.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { LimitLabels } from '../feature-limit/limits.enum';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly featureLimitService: FeatureLimitService,
  ) {}

  @Get('/enabled')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if referral feature is enabled for user' })
  @ApiOkResponse({ description: 'Referral feature status' })
  async isEnabled(@UserDecorator() user: User) {
    const limit = await this.featureLimitService.getUserLimitByLabel(
      LimitLabels.ReferralAccess,
      user,
    );
    return { isEnabled: limit?.isFeatureEnabled() ?? false };
  }

  @Post('/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate referral token' })
  @ApiOkResponse({ description: 'Referral token generated successfully' })
  async generateToken(@UserDecorator() user: User) {
    const limit = await this.featureLimitService.getUserLimitByLabel(
      LimitLabels.ReferralAccess,
      user,
    );

    if (!limit?.isFeatureEnabled()) {
      throw new PaymentRequiredException(
        'Referral access not allowed for this user tier',
      );
    }

    const token = this.referralService.generateToken(user.uuid, user.createdAt);
    return { token };
  }
}
