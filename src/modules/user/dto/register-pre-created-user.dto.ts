import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { type SharingInvite } from '../../sharing/sharing.domain';

export class RegisterPreCreatedUserDto extends CreateUserDto {
  @IsOptional()
  @ApiPropertyOptional({
    example: '0f8fad5b-d9cb-469f-a165-70867728950e',
    description: 'id of the invitation',
  })
  @IsUUID()
  invitationId?: SharingInvite['id'];

  @IsOptional()
  @ApiPropertyOptional({
    description:
      'Token from the invitation email link. Proves the email ownership',
  })
  @IsString()
  token?: string;
}
