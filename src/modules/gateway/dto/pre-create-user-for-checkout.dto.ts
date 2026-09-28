import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class PreCreateUserForCheckoutDto {
  @ApiProperty({
    example: 'user@internxt.com',
    description: 'Email of the customer starting a checkout',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}

export class PreCreateUserForCheckoutResponseDto {
  @ApiProperty({
    example: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
    description: 'UUID shared by the pre-created user and the network user',
  })
  uuid: string;

  @ApiProperty({
    example: false,
    description:
      'Whether the user already paid and has not completed the account setup yet',
  })
  setupPending: boolean;
}
