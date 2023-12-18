import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SetSharingPasswordDto {
  @ApiProperty({
    example: 'thisIsAPassword',
    description: 'password encrypted with code generated client side',
  })
  @IsNotEmpty()
  encryptedPassword: string;
}
