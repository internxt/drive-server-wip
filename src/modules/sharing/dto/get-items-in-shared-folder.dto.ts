import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GetItemsInSharedFolderQueryDto {
  @ApiProperty({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  page: number = 0;

  @ApiProperty({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  perPage: number = 50;

  @ApiProperty({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  // TODO: restrict to allowed values
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiProperty({
    name: 'token',
    description: 'Token that authorizes the access to the shared content',
    type: String,
  })
  @IsString()
  token: string;
}
