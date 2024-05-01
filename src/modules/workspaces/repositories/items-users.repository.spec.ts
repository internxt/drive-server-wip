import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { SequelizeWorkspaceItemsUsersRepository } from './items-users.repository';
import { WorkspaceItemUser } from '../domains/workspace-items-users.domain';
import { newItemUser } from 'test/fixtures';
import { WorkspaceItemUserModel } from '../models/workspace-items-users.model';
import { getModelToken } from '@nestjs/sequelize';

describe('SequelizeWorkspaceItemsUsersRepository', () => {
  let repository: SequelizeWorkspaceItemsUsersRepository;
  let workspaceItemsUsersModel: typeof WorkspaceItemUserModel;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeWorkspaceItemsUsersRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeWorkspaceItemsUsersRepository>(
      SequelizeWorkspaceItemsUsersRepository,
    );
    workspaceItemsUsersModel = module.get<typeof WorkspaceItemUserModel>(
      getModelToken(WorkspaceItemUserModel),
    );
  });

  describe('getAllByWorkspaceId', () => {
    it('should return all items users by workspace id', async () => {
      const workspaceId = '1';
      const mockItemsUsers: WorkspaceItemUser[] = [];
      for (let i = 0; i < 4; i++) {
        mockItemsUsers.push(newItemUser({ workspaceId }));
      }
      jest
        .spyOn(workspaceItemsUsersModel, 'findAll')
        .mockResolvedValueOnce(mockItemsUsers as any);

      const itemsUsers = await repository.getAllByWorkspaceId(workspaceId);

      expect(itemsUsers).toEqual([]);
    });
  });
});
