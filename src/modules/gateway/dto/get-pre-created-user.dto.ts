import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class GetPreCreatedUserDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'Email of the pre-created user',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}
