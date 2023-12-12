import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SetSharingPasswordDto {
  @ApiProperty({
    example: 'codeexample',
    description: 'Code generate client side',
  })
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'thisIsAPassword',
    description: 'password',
  })
  @IsNotEmpty()
  password: string;
}
