import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GrantPrivilegesDto {
  @IsUUID()
  @ApiProperty({ required: true })
  userUuid: string;

  @IsUUID()
  @ApiProperty({ required: true })
  privateFolderId: string;

  @IsUUID()
  @ApiProperty({ required: true })
  roleId: string;
}
