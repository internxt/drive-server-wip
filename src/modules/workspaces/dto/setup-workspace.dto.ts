import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Workspace } from '../domains/workspaces.domain';
import { WorkspaceUserAttributes } from '../attributes/workspace-users.attributes';

export class SetupWorkspaceDto {
  @ApiProperty({
    example: 'My workspace',
    description: 'Name of the team to be created',
  })
  @IsNotEmpty()
  name: Workspace['name'];

  @ApiProperty({
    example: 'Address',
    description: 'Address of the workspace',
  })
  address: Workspace['address'];

  @ApiProperty({
    example: 'My workspae',
    description: 'Workspace description',
  })
  description: Workspace['description'];

  @ApiProperty({
    example: 'Encrypted key',
    description: 'Owner mnemnonic encrypted with its public key',
  })
  @IsNotEmpty()
  encryptedMnemonic: WorkspaceUserAttributes['key'];
}
