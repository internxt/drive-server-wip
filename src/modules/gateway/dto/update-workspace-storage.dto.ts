import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateWorkspaceStorageDto {
  @ApiProperty({
    example: 'Id of the owner',
    description: 'Uuid of the owner of the space',
  })
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({
    example: '312321312',
    description: 'Workspace max space in bytes',
  })
  @IsNotEmpty()
  @IsNumber()
  maxSpaceBytes: number;
}
