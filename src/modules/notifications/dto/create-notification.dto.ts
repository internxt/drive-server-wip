import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsIn, IsDateString } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    example: 'https://internxt.com/promotions/black-friday',
    description: 'URL link for the notification',
  })
  @IsNotEmpty()
  link: string;

  @ApiProperty({
    example: 'Black Friday Sale - 50% off all plans!',
    description: 'Notification message content',
  })
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    example: 'all',
    description: 'Target type for notification delivery',
    enum: ['all', 'user'],
  })
  @IsNotEmpty()
  @IsIn(['all', 'user'])
  targetType: string;

  @ApiProperty({
    example: null,
    description: 'Target value - user email for user type, null for all',
    required: false,
  })
  @IsOptional()
  targetValue?: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59Z',
    description: 'Optional expiration date for the notification',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
