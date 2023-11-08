import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { SharingType } from '../sharing.domain';

export class ChangeSharingType {
  @ApiProperty({
    example: 'public',
    description: 'New type you want to set for the sharing',
  })
  @IsNotEmpty()
  @IsEnum(SharingType)
  sharingType: SharingType;
}
