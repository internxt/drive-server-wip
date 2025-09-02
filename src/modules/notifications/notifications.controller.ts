import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NotificationsUseCases } from './notifications.usecase';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsGuard } from './notifications.guard';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsUseCases: NotificationsUseCases) {}

  @Post('/')
  @UseGuards(NotificationsGuard)
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
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsUseCases.createNotification(
      createNotificationDto,
    );
    return new NotificationResponseDto(notification);
  }
}
