import { OmitType } from '@nestjs/swagger';
import { GetFilesDto } from './get-files.dto';

export class GetFavoriteFilesDto extends OmitType(GetFilesDto, [
  'status',
  'bucket',
] as const) {}
