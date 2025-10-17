import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, ValidateIf, IsDefined } from 'class-validator';

export class DeleteTfaDto {
  @ApiProperty({
    example: 'password_example',
    description: 'User password',
    required: false,
  })
  @IsOptional()
  @ValidateIf((dto) => dto.pass !== undefined && dto.pass !== '')
  @IsNotEmpty()
  pass?: string;

  @ApiProperty({
    example: '123456',
    description: 'Code tfa',
    required: false,
  })
  @IsOptional()
  @ValidateIf((dto) => dto.code !== undefined && dto.code !== '')
  @IsNotEmpty()
  code?: string;

  @ValidateIf((dto) => !dto.pass && !dto.code)
  @IsDefined({
    message: 'At least one of password or TFA code must be provided',
  })
  readonly atLeastOneField?: boolean;
}
