import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttemptChangeEmailDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    example: 'my_new_email@internxt.com',
    description: 'The new email of the user',
  })
  public readonly newEmail: string;
}
