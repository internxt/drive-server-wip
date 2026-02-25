import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { type SharingInvite } from '../../sharing/sharing.domain';

export class RegisterPreCreatedUserDto extends CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '0f8fad5b-d9cb-469f-a165-70867728950e',
    description: 'id of the invitation',
  })
  @IsUUID()
  invitationId: SharingInvite['id'];
}
