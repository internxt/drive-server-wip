import { IsString } from 'class-validator';

export class UpdateFolderMetaDto {
  @IsString()
  plainName: string;
}
