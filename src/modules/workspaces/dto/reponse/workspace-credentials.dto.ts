import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WorkspaceCredentialsDetailsDto {
  @ApiProperty({ example: 'networkPass', description: 'Network password' })
  @IsString()
  networkPass: string;

  @ApiProperty({ example: 'networkUser', description: 'Network user' })
  @IsString()
  networkUser: string;
}

export class WorkspaceCredentialsDto {
  @ApiProperty({ example: 'workspaceId', description: 'workspaceId' })
  @IsString()
  workspaceId: string;

  @ApiProperty({ example: 'bucket', description: 'bucket' })
  @IsString()
  bucket: string;

  @ApiProperty({ example: 'workspaceUserId', description: 'workspaceUserId' })
  @IsString()
  workspaceUserId: string;

  @ApiProperty({ example: 'email', description: 'email' })
  email: string;

  @ApiProperty({ type: WorkspaceCredentialsDetailsDto })
  credentials: WorkspaceCredentialsDetailsDto;

  @ApiProperty({ example: 'tokenHeader', description: 'tokenHeader' })
  tokenHeader: string;
}
