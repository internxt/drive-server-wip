import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkspacesUsecases } from './workspaces.usecase';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspaceUseCases: WorkspacesUsecases) {}
}
