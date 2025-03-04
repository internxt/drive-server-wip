import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID } from 'class-validator';

export class CheckStorageExpansionDto {
  @ApiProperty({
    example: 'f9d113e3-8267-4419-a309-9b601f4f6f9b',
    description: 'UUID of the user',
  })
  @IsUUID()
  userUuid: string;

  @ApiProperty({
    example: 312321312,
    description: 'Extra space in bytes to add to the user',
  })
  @IsNumber()
  additionalBytes: number;
}
