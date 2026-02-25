import { ApiProperty } from '@nestjs/swagger';
import { type Notification } from '../../domain/notification.domain';

export class NotificationResponseDto {
  constructor(notification: Partial<Notification>) {
    this.id = notification.id;
    this.link = notification.link;
    this.createdAt = notification.createdAt;
    this.message = notification.message;
    this.expiresAt = notification.expiresAt;
  }

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier for the notification',
  })
  id: string;

  @ApiProperty({
    example: 'https://internxt.com/promotions/black-friday',
    description: 'URL link for the notification',
  })
  link: string;

  @ApiProperty({
    example: 'Black Friday Sale - 50% off all plans!',
    description: 'Notification message content',
  })
  message: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59.000Z',
    description: 'Optional expiration date for the notification',
    nullable: true,
  })
  expiresAt: Date | null;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;
}
