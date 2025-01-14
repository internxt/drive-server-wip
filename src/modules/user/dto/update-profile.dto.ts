import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { UserAttributes } from '../user.attributes';

export class UpdateProfileDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'Internxt',
    description: 'Name of the new user',
  })
  name: UserAttributes['name'];

  @IsNotEmpty()
  @ApiProperty({
    example: 'Lastname',
    description: 'Last name of the new user',
  })
  lastname: UserAttributes['lastname'];
}
