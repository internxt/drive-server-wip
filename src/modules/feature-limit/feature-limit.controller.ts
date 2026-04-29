import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { FeatureLimitsDto } from './dto/feature-limits.dto';
import { User } from '../user/user.domain';
import { User as UserDecorator } from '../auth/decorators/user.decorator';

@ApiTags('Limits')
@Controller('feature-limits')
export class FeatureLimitController {
  constructor(private readonly featureLimitUsecases: FeatureLimitUsecases) {}

  @Get('/')
  @ApiOperation({ summary: 'Get feature limits for the authenticated user' })
  @ApiOkResponse({
    description: 'Feature limits retrieved',
    type: FeatureLimitsDto,
  })
  async getFeatureLimits(
    @UserDecorator() user: User,
  ): Promise<FeatureLimitsDto> {
    return this.featureLimitUsecases.getUserFeatureLimits(user);
  }
}
