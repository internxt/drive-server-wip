import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
export enum ItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class SendLinkItemDto {
  @ApiProperty({
    example: 'id1',
    description: 'Id of file',
  })
  id: string;

  @IsEnum(ItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item',
  })
  type: ItemType;
}
export class CreateSendLinkDto {
  @ApiProperty({
    example: 'fake@mail.com',
    description: 'Email to send link',
  })
  receiver: string;

  @ApiProperty({
    description: 'List of items of files and folders',
  })
  @Type(() => SendLinkItemDto)
  items: SendLinkItemDto[];
}
