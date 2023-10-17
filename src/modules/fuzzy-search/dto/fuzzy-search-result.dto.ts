import { ApiProperty } from '@nestjs/swagger';
import { ItemType, itemTypes } from '../look-up.domain';

export class FuzzySearchResult {
  @ApiProperty()
  id: string;

  @ApiProperty()
  itemId: string;

  @ApiProperty({ enum: itemTypes })
  itemType: ItemType;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  rank?: null | number;

  @ApiProperty()
  similarity: number;
}

export class FuzzySearchResults {
  @ApiProperty({ type: [FuzzySearchResult] })
  data: FuzzySearchResult[];
}
