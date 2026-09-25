import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class PreCreateUserWithPlanDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'Email of the customer who paid for a plan',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Premium',
    description: 'Name of the purchased plan, shown in the account setup email',
  })
  @IsString()
  @IsNotEmpty()
  planName: string;
}

export class PreCreateUserWithPlanResponseDto {
  @ApiProperty({
    example: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
    description: 'UUID shared by the pre-created user and the network user',
  })
  uuid: string;
}
