import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class DeleteWorkspaceDto {
  @ApiProperty({
    example: 'Id of the owner',
    description: 'Uuid of the owner of the space',
  })
  @IsNotEmpty()
  ownerId: string;
}
