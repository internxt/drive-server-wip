import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMailAccountDto {
  @ApiProperty({ example: 'john' })
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiProperty({ example: 'inxt.eu' })
  @IsNotEmpty()
  @IsString()
  domain: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Encrypted password for re-authentication' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
