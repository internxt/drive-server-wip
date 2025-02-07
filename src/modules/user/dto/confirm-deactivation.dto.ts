import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmAccountDeactivationDto {
  @ApiProperty({
    example: 'token',
    description: 'Token sent to user email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
