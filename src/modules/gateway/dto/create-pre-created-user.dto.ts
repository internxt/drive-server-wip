import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class CreatePreCreatedUserDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'Email of the customer starting a checkout',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}
