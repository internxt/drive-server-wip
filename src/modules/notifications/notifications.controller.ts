import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NotificationsUseCases } from './notifications.usecase';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsGuard } from './notifications.guard';
import { User } from '../auth/decorators/user.decorator';
import { User as UserDomain } from '../user/user.domain';
import { NotificationWithStatusDto } from './dto/response/notification-with-status.dto';
import { NotificationResponseDto } from './dto/response/notification-response.dto';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsUseCases: NotificationsUseCases) {}

  @Get('/')
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Retrieves all notifications for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User notifications retrieved successfully',
    type: NotificationWithStatusDto,
    isArray: true,
  })
  async getUserNotifications(
    @User() user: UserDomain,
  ): Promise<NotificationWithStatusDto[]> {
    const notifications =
      await this.notificationsUseCases.getNewNotificationsForUser(user.uuid);

    const notificationDtos = notifications.map(
      (notificationWithStatus) =>
        new NotificationWithStatusDto({
          ...notificationWithStatus,
        }),
    );

    return notificationDtos;
  }

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

  @Patch('/:id/expire')
  @UseGuards(NotificationsGuard)
  @ApiOperation({
    summary: 'Mark notification as expired',
    description:
      'Marks a notification as expired by setting its expiration date to now',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as expired successfully',
    type: NotificationResponseDto,
  })
  async markNotificationAsExpired(
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const notification =
      await this.notificationsUseCases.markNotificationAsExpired(id);
    return new NotificationResponseDto(notification);
  }
}
