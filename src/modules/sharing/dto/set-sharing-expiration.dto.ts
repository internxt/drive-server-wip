import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class SetSharingExpirationDto {
  @ApiProperty({
    example: '2026-10-31T22:59:59.999Z',
    description: 'Expiration date of the public sharing link',
  })
  @IsNotEmpty()
  @IsDateString()
  linkExpirationDate: string;
}
