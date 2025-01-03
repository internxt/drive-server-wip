import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AreCredentialsCorrectDto {
  @ApiProperty({
    example: 'some_hashed_pass',
    description: 'User hashed password',
  })
  @IsNotEmpty()
  @IsString()
  hashedPassword: string;
}
