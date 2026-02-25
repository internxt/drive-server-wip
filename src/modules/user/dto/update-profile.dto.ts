import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { type UserAttributes } from '../user.attributes';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.name !== null)
  @IsNotEmpty({ message: 'Name should not be empty if provided.' })
  @MaxLength(100, { message: 'Name must be at most 100 characters long.' })
  @ApiProperty({
    example: 'Internxt',
    description: 'Name of the new user',
  })
  name?: UserAttributes['name'];

  @ValidateIf((o) => o.name === null)
  @IsNotEmpty({ message: 'Name should not be null if provided.' })
  @ApiProperty({
    example: 'Internxt',
    description: 'Name of the new user',
  })
  nameNullCheck?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.lastname !== null)
  @MaxLength(100, { message: 'Lastname must be at most 100 characters long.' })
  @ApiProperty({
    example: 'Lastname',
    description: 'Last name of the new user',
  })
  lastname?: UserAttributes['lastname'];

  @ValidateIf((o) => o.lastname === null)
  @IsNotEmpty({ message: 'Lastname should not be null if provided.' })
  @ApiProperty({
    example: 'Lastname',
    description: 'Last name of the new user',
  })
  lastnameNullCheck?: string;
}
