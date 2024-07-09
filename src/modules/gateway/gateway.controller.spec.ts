import { DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { UpdateWorkspaceStorageDto } from './dto/update-workspace-storage.dto';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { GatewayUseCases } from './gateway.usecase';
import { GatewayController } from './gateway.controller';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { v4 } from 'uuid';

describe('Gateway Controller', () => {
  let gatewayController: GatewayController;
  let gatewayUsecases: DeepMocked<GatewayUseCases>;

  beforeEach(async () => {
    gatewayUsecases = createMock<GatewayUseCases>();
    gatewayController = new GatewayController(gatewayUsecases);
  });

  it('should be defined', () => {
    expect(gatewayController).toBeDefined();
  });

  describe('POST /workspaces', () => {
    const owner = newUser();
    const initializeWorkspaceDto: InitializeWorkspaceDto = {
      ownerId: owner.uuid,
      maxSpaceBytes: 1000000,
      address: '123 Main St',
    };

    it('When workspace is created successfully, then return', async () => {
      const workspace = newWorkspace({
        owner,
        attributes: {
          ownerId: owner.uuid,
        },
      });
      jest
        .spyOn(gatewayUsecases, 'initializeWorkspace')
        .mockResolvedValueOnce({ workspace });

      await expect(
        gatewayController.initializeWorkspace(initializeWorkspaceDto),
      ).resolves.toStrictEqual({ workspace });
    });
  });

  describe('PUT /workspaces/storage', () => {
    const updateWorkspaceStorageDto: UpdateWorkspaceStorageDto = {
      ownerId: v4(),
      maxSpaceBytes: 1000000,
    };

    it('When owner passed is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'updateWorkspaceStorage')
        .mockRejectedValueOnce(new BadRequestException());
      await expect(
        gatewayController.updateWorkspaceStorage(updateWorkspaceStorageDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'updateWorkspaceStorage')
        .mockRejectedValueOnce(new NotFoundException());
      await expect(
        gatewayController.updateWorkspaceStorage(updateWorkspaceStorageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When correct data is passed and workspace completed is found, then it works.', async () => {
      await gatewayController.updateWorkspaceStorage(updateWorkspaceStorageDto);
      expect(gatewayUsecases.updateWorkspaceStorage).toHaveBeenCalledWith(
        updateWorkspaceStorageDto.ownerId,
        updateWorkspaceStorageDto.maxSpaceBytes,
      );
    });
  });

  describe('DELETE /workspaces', () => {
    const deleteWorkspaceDto: DeleteWorkspaceDto = {
      ownerId: v4(),
    };

    it('When owner passed is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'destroyWorkspace')
        .mockRejectedValueOnce(new BadRequestException());
      await expect(
        gatewayController.destroyWorkspace(deleteWorkspaceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'destroyWorkspace')
        .mockRejectedValueOnce(new NotFoundException());
      await expect(
        gatewayController.destroyWorkspace(deleteWorkspaceDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('When workspace is removed succesfully, then return', async () => {
      await gatewayController.destroyWorkspace(deleteWorkspaceDto);
      expect(gatewayUsecases.destroyWorkspace).toHaveBeenCalledWith(
        deleteWorkspaceDto.ownerId,
      );
    });
  });

  describe('GET /users', () => {
    const user = newUser();

    it('When user is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'getUserByEmail')
        .mockRejectedValueOnce(new BadRequestException());
      await expect(
        gatewayController.getUserByEmail(user.email),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user exists, then it is returned', async () => {
      jest.spyOn(gatewayUsecases, 'getUserByEmail').mockResolvedValueOnce(user);

      await expect(
        gatewayController.getUserByEmail(user.email),
      ).resolves.toStrictEqual(user);

      expect(gatewayUsecases.getUserByEmail).toHaveBeenCalledWith(user.email);
    });
  });
});
