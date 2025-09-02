import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsDateString, IsEmail } from 'class-validator';

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
    example: 'test@interxt.com',
    description:
      'Target user email, if missing, notification is sent to everyone',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59Z',
    description: 'Optional expiration date for the notification',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
