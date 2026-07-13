import { OmitType } from '@nestjs/swagger';
import { GetFoldersQueryDto } from './get-folders.dto';

export class GetFavoriteFoldersDto extends OmitType(GetFoldersQueryDto, [
  'status',
] as const) {}
