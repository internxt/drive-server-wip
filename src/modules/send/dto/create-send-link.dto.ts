import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
  ValidateNested,
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

  @IsInt()
  @Min(0)
  @Max(5368709120, { message: 'size must not be greater than 5G' })
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
    description: 'Encrypted code used before in plain, to encrypt the mnemonic',
  })
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: '03849067907409723908abcdef',
    description:
      'Code in plain, which is required to share this link with anyone',
  })
  @IsNotEmpty()
  plainCode: string;

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
  @ValidateNested({ each: true })
  @ArrayMaxSize(100)
  items: SendLinkItemDto[];

  @ApiProperty({
    example: 'Super secret password',
    description: 'Password to unlock the link',
  })
  @IsOptional()
  plainPassword?: string;
}
