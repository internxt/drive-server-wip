import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RequestAccountUnblock {
  @ApiProperty({
    example: 'hello@internxt.com',
    description: 'User email',
  })
  @IsNotEmpty()
  email: string;
}
