import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
export enum ItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class SendLinkItemDto {
  @ApiProperty({
    example: 'Item 1',
    description: 'Name of file',
  })
  name: string;

  @IsEnum(ItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item',
  })
  type: ItemType;

  @ApiProperty({
    example: '100',
    description: 'size of item',
  })
  size: number;

  @ApiProperty({
    example: 'networkID',
    description: 'networkId of item',
  })
  networkId: string;

  @ApiProperty({
    example: 'key encrypted',
    description: 'encryptionKey of item',
  })
  encryptionKey: string;
}
export class CreateSendLinkDto {
  @ApiProperty({
    example: '[fake@mail.com]',
    description: 'Emails of destinatary',
  })
  @IsArray()
  @IsOptional()
  receivers: Array<string>;

  @ApiProperty({
    example: 'sender@mail.com',
    description: 'Email of sender',
  })
  @IsOptional()
  sender: string;

  @ApiProperty({
    example: 'code',
    description: 'Code to send link',
  })
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Test title',
    description: 'Title to send link',
  })
  @IsOptional()
  title: string;

  @ApiProperty({
    example: 'Subject',
    description: 'Subject to send link',
  })
  @IsOptional()
  subject: string;

  @ApiProperty({
    description: 'List of items of files and folders',
  })
  @Type(() => SendLinkItemDto)
  @IsArray()
  @ArrayMaxSize(50)
  items: SendLinkItemDto[];
}
