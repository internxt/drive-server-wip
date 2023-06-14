export interface ThumbnailAttributes {
  id: number;
  fileId: number;
  type: string;
  size: number;
  bucket_id: string;
  bucket_file: string;
  encrypt_version: string;
  created_at: Date;
  updated_at: Date;
  max_width: number;
  max_height: number;
}
