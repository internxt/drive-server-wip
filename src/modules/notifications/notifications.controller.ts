import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { NotificationsUseCases } from './notifications.usecase';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsUseCases: NotificationsUseCases) {}
}
