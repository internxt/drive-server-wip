import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class DeleteTfaDto {
  @ApiProperty({
    example: 'password_example',
    description: 'User password',
  })
  @IsNotEmpty()
  pass: string;

  @ApiProperty({
    example: '123456',
    description: 'Code tfa',
  })
  @IsNotEmpty()
  code: string;
}
