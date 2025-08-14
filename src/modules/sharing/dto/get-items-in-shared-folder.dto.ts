import { ApiProperty } from '@nestjs/swagger';

export class GetItemsInSharedFolderQueryDto {
  @ApiProperty({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  page: number = 0;

  @ApiProperty({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  perPage: number = 50;

  @ApiProperty({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  orderBy?: string;

  @ApiProperty({
    name: 'token',
    description: 'Token that authorizes the access to the shared content',
    type: String,
  })
  token: string;
}
