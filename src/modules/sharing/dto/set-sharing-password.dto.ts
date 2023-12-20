import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty } from 'class-validator';

export class SetSharingPasswordDto {
  @ApiProperty({
    example: 'thisIsAPassword',
    description: 'password encrypted with code generated client side',
  })
  @IsNotEmpty()
  @IsBase64()
  encryptedPassword: string;
}
