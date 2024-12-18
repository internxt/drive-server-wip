import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UpdateTfaDto {
  @ApiProperty({
    example: 'key_example',
    description: 'Key value',
  })
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    example: '123456',
    description: 'Code tfa',
  })
  @IsNotEmpty()
  code: string;
}
