import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { type User } from '../user/user.domain';
import { ReferralService } from './referral.service';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Post('/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate referral token' })
  @ApiOkResponse({ description: 'Referral token generated successfully' })
  async generateToken(@UserDecorator() user: User) {
    const token = this.referralService.generateToken(user.uuid, user.createdAt);
    return { token };
  }
}
