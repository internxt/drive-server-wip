import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { Role, Sharing } from '../../sharing.domain';
import { Folder } from '../../../folder/folder.domain';
import { NetworkCredentialsDto, SharingOwnerInfoDto } from './shared-base.dto';
import { FileDto } from '../../../file/dto/responses/file.dto';
import { FolderDto } from '../../../folder/dto/responses/folder.dto';

class ParentFolderDto {
  @ApiProperty({
    description: 'UUID of the parent folder',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  uuid: Folder['uuid'] | null;

  @ApiProperty({
    description: 'Plain name of the parent folder',
    example: 'Documents',
    nullable: true,
  })
  name: Folder['plainName'] | null;
}

class SharedFolderResponseBaseDto {
  @ApiProperty({
    description: 'Network credentials for accessing the folder',
    type: NetworkCredentialsDto,
  })
  credentials: NetworkCredentialsDto;

  @ApiProperty({
    description: 'Plain name of the current folder',
    example: 'My Shared Folder',
  })
  name: Folder['plainName'];

  @ApiProperty({
    description: 'Encryption key for the shared folder',
    example: 'abc123def456',
    nullable: true,
  })
  encryptionKey: Sharing['encryptionKey'] | null;

  @ApiProperty({
    description: 'JWT token for folder access',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: 'Storage bucket identifier',
    example: 'bucket-123456',
  })
  bucket: string;

  @ApiProperty({
    description: 'Parent folder information',
    type: ParentFolderDto,
  })
  parent: ParentFolderDto;

  @ApiProperty({
    description: 'User role in the shared folder',
    example: 'EDITOR',
    enum: ['OWNER', 'EDITOR', 'VIEWER'],
  })
  role: Role['name'];
}

export class FileInSharedFolderDto extends IntersectionType(FileDto) {
  @ApiProperty({
    description: 'Owner of the file',
    nullable: true,
    type: SharingOwnerInfoDto,
  })
  user?: SharingOwnerInfoDto;
}

export class FolderInSharedFolderDto extends IntersectionType(FolderDto) {
  @ApiProperty({
    description: 'Owner of the folder',
    nullable: true,
    type: SharingOwnerInfoDto,
  })
  user?: SharingOwnerInfoDto;
}

export class GetFoldersInSharedFolderResponseDto extends SharedFolderResponseBaseDto {
  @ApiProperty({
    description: 'List of folders in the shared folder',
    type: [FolderInSharedFolderDto],
  })
  items: FolderInSharedFolderDto[];
}

export class GetFilesInSharedFolderResponseDto extends SharedFolderResponseBaseDto {
  @ApiProperty({
    description: 'List of files in the shared folder',
    type: [FileInSharedFolderDto],
  })
  items: FileInSharedFolderDto[];
}
