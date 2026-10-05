import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PreCreatedUserStatus } from '../../user/pre-created-users.attributes';

export class PreCreateUserForCheckoutResponseDto {
  @ApiProperty({
    example: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
    description: 'UUID shared by the pre-created user and the network user',
  })
  uuid: string;

  @ApiProperty({
    example: 'awaiting_payment',
    description: 'The status of the pre-created user',
    required: false,
  })
  @IsEnum(PreCreatedUserStatus)
  status?: PreCreatedUserStatus;
}
