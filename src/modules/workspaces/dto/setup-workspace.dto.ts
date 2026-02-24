import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { type Workspace } from '../domains/workspaces.domain';
import { type WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';

export class SetupWorkspaceDto {
  @ApiProperty({
    example: 'My workspace',
    description: 'Name of the workspace to be created',
  })
  @IsOptional()
  name?: Workspace['name'];

  @ApiProperty({
    example: 'Address',
    description: 'Address of the workspace',
  })
  @IsOptional()
  address?: Workspace['address'];

  @ApiProperty({
    example: 'My workspae',
    description: 'Workspace description',
  })
  @IsOptional()
  description?: Workspace['description'];

  @ApiProperty({
    example: 'Encrypted key in base64',
    description: 'Owner mnemnonic encrypted with their public key in base64',
  })
  @IsNotEmpty()
  encryptedMnemonic: WorkspaceUserAttributes['key'];
}
