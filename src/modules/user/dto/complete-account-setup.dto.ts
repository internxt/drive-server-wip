import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class CompleteAccountSetupDto extends OmitType(CreateUserDto, [
  'email',
] as const) {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token received in the account setup email link',
  })
  token: string;
}
