import { IsString } from 'class-validator';

export class UpdateFileMetaDto {
  @IsString()
  plainName: string;
}
