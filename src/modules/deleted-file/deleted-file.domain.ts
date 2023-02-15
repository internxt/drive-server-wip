import { DeletedFileDto } from './dto/deleted-file.dto';
export interface DeletedFileAttributes {
  file_id: string;
  user_id: number;
  folder_id: number;
  bucket: string;
}

export class DeletedFile implements DeletedFileAttributes {
  file_id: string;
  user_id: number;
  folder_id: number;
  bucket: string;
  private constructor({
    file_id,
    user_id,
    folder_id,
    bucket,
  }: DeletedFileAttributes) {
    this.file_id = file_id;
    this.user_id = user_id;
    this.folder_id = folder_id;
    this.bucket = bucket;
  }

  static build(file: DeletedFileAttributes): DeletedFile {
    return new DeletedFile(file);
  }

  toJSON(): DeletedFileDto {
    return {
      file_id: this.file_id,
      user_id: this.user_id,
      folder_id: this.folder_id,
      bucket: this.bucket,
    };
  }
}
