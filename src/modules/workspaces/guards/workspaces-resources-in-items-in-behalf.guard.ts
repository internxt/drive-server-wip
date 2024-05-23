import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspacesUsecases } from '../workspaces.usecase';
import { User } from '../../user/user.domain';
import {
  WORKSPACE_IN_BEHALF_SOURCES_META_KEY,
  DataSource,
} from './workspaces-resources-in-behalf.decorator';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';

@Injectable()
export class WorkspacesResourcesItemsInBehalfGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceUseCases: WorkspacesUsecases,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const dataSources = this.reflector.get<DataSource[]>(
      WORKSPACE_IN_BEHALF_SOURCES_META_KEY,
      context.getHandler(),
    );

    const workspaceHeader = request.headers['x-internxt-workspace'];

    if (!workspaceHeader) {
      return true;
    }

    const requester = User.build({ ...request.user });

    if (!requester) {
      return false;
    }

    const extractedData = this.extractDataFromRequest(request, dataSources);

    const behalfUser = await this.validateItemCreatedByAndGetResourceOwner(
      requester,
      extractedData.itemId,
      extractedData.itemType,
    );

    request.user = behalfUser;
    request.requester = requester;

    return true;
  }

  async validateItemCreatedByAndGetResourceOwner(
    requester: User,
    itemId: WorkspaceItemUser['itemId'],
    itemType: WorkspaceItemUser['itemType'],
  ) {
    return this.workspaceUseCases.getWorkspaceResourceOwnerByItemAndCreator(
      requester,
      itemId,
      itemType,
    );
  }

  extractDataFromRequest(
    request: Request,
    dataSources: DataSource[],
  ): { itemId?: WorkspaceItemUser['itemId']; itemType?: WorkspaceItemType } {
    const extractedData = {};

    for (const { sourceKey, fieldName, value, newFieldName } of dataSources) {
      const extractedValue =
        value !== undefined ? value : request[sourceKey][fieldName];

      const isValueUndefined =
        extractedValue === undefined || extractedValue === null;

      if (isValueUndefined) {
        new Logger().error(
          `[WORKSPACES_BEHALF_GUARD]: Missing required field to validate user access to resource! field: ${fieldName}`,
        );
        throw new BadRequestException(`Missing required field: ${fieldName}`);
      }

      const targetFieldName = newFieldName ? newFieldName : fieldName;

      extractedData[targetFieldName] = extractedValue;
    }

    return extractedData;
  }
}
