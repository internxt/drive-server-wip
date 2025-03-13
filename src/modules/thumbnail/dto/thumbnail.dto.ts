import { ApiProperty } from '@nestjs/swagger';

export class ThumbnailDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  fileId: number;
  @ApiProperty()
  maxWidth: number;
  @ApiProperty()
  maxHeight: number;
  @ApiProperty()
  type: string;
  @ApiProperty()
  size: number;
  @ApiProperty()
  bucketId: string;
  @ApiProperty()
  bucketFile: string;
  @ApiProperty()
  encryptVersion: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}
