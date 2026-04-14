import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthTokenGuard } from './health.guard';
import { HealthService } from './health.service';
import { DisableGlobalAuth } from '../../modules/auth/decorators/disable-global-auth.decorator';

@ApiTags('Health')
@Controller('health')
@DisableGlobalAuth()
@UseGuards(HealthTokenGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe — checks services',
  })
  async ready() {
    return this.healthService.check();
  }
}
