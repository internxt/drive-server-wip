import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class FailedPaymentDto {
  @ApiProperty({
    description: 'UUID of the user who had a failed payment',
    example: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
