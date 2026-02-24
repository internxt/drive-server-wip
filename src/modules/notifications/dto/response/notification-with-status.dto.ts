import { ApiProperty } from '@nestjs/swagger';
import { type Notification } from '../../domain/notification.domain';
import { NotificationResponseDto } from './notification-response.dto';

export class NotificationWithStatusDto extends NotificationResponseDto {
  constructor(args: {
    notification: Notification;
    isRead: boolean;
    deliveredAt: Date;
    readAt: Date | null;
  }) {
    super(args.notification);
    this.isRead = args.isRead;
    this.deliveredAt = args.deliveredAt;
    this.readAt = args.readAt;
  }

  @ApiProperty({
    example: true,
    description: 'Whether the notification has been read by the user',
  })
  isRead: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'When the notification was delivered to the user',
  })
  deliveredAt: Date;

  @ApiProperty({
    example: '2024-01-01T12:00:00.000Z',
    description: 'When the notification was read by the user',
    nullable: true,
  })
  readAt: Date | null;
}
