import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdatePrivilegesDto {
  @IsUUID()
  @ApiProperty({ required: true })
  roleId: string;
}
