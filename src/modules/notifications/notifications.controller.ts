import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NotificationsUseCases } from './notifications.usecase';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './domain/notification.domain';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsUseCases: NotificationsUseCases) {}

  @Post('/')
  @ApiOperation({
    summary: 'Create a new notification',
    description: 'Creates a new notification',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: NotificationResponseDto,
  })
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    return this.notificationsUseCases.createNotification(createNotificationDto);
  }
}
