import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceCredentialsDetailsDto {
  @ApiProperty()
  networkPass: string;
  @ApiProperty()
  networkUser: string;
}

export class WorkspaceCredentialsDto {
  @ApiProperty()
  workspaceId: string;
  @ApiProperty()
  bucket: string;
  @ApiProperty()
  workspaceUserId: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ type: WorkspaceCredentialsDetailsDto })
  credentials: WorkspaceCredentialsDetailsDto;
  @ApiProperty()
  tokenHeader: string;
}
