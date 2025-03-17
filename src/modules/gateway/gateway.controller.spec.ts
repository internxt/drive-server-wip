import { DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { UpdateWorkspaceStorageDto } from './dto/update-workspace-storage.dto';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { GatewayUseCases } from './gateway.usecase';
import { GatewayController } from './gateway.controller';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { v4 } from 'uuid';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Test } from '@nestjs/testing';

describe('Gateway Controller', () => {
  let gatewayController: GatewayController;
  let gatewayUsecases: DeepMocked<GatewayUseCases>;
  let storageNotificationsService: DeepMocked<StorageNotificationService>;
  let loggerMock: DeepMocked<Logger>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [],
      providers: [GatewayController],
    })
      .useMocker(() => createMock())
      .compile();

    loggerMock = createMock<Logger>();
    moduleRef.useLogger(loggerMock);
    gatewayController = moduleRef.get(GatewayController);
    gatewayUsecases = moduleRef.get(GatewayUseCases);
    storageNotificationsService = moduleRef.get(StorageNotificationService);
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
      numberOfSeats: 20,
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
      numberOfSeats: 5,
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
        updateWorkspaceStorageDto.numberOfSeats,
      );
    });
  });

  describe('POST /workspaces/storage/precheck', () => {
    const updateWorkspaceStorageDto: UpdateWorkspaceStorageDto = {
      ownerId: v4(),
      maxSpaceBytes: 1000000,
      numberOfSeats: 5,
    };

    it('When owner passed is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'validateStorageForPlanChange')
        .mockRejectedValueOnce(new BadRequestException());
      await expect(
        gatewayController.validateStorageForPlanChange(
          updateWorkspaceStorageDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace is not found, then it should throw.', async () => {
      jest
        .spyOn(gatewayUsecases, 'validateStorageForPlanChange')
        .mockRejectedValueOnce(new NotFoundException());
      await expect(
        gatewayController.validateStorageForPlanChange(
          updateWorkspaceStorageDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('When correct data is passed and workspace completed is found, then it works.', async () => {
      await gatewayController.validateStorageForPlanChange(
        updateWorkspaceStorageDto,
      );
      expect(gatewayUsecases.validateStorageForPlanChange).toHaveBeenCalledWith(
        updateWorkspaceStorageDto.ownerId,
        updateWorkspaceStorageDto.maxSpaceBytes,
        updateWorkspaceStorageDto.numberOfSeats,
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

  describe('GET /users/storage/stackability', () => {
    const user = newUser();

    it('When called, it should call service with respective params', async () => {
      const userUuid = user.uuid;
      const additionalBytes = 10;

      await gatewayController.checkUserStorageExpansion({
        userUuid,
        additionalBytes,
      });

      expect(gatewayUsecases.checkUserStorageExpansion).toHaveBeenCalledWith(
        userUuid,
        additionalBytes,
      );
    });
  });

  describe('PATCH /users/:uuid', () => {
    const user = newUser();
    const updateUserDto = {
      maxSpaceBytes: 2000000,
    };

    it('When user is found and updated successfully, then it should send notification', async () => {
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(user);

      await gatewayController.updateUser(user.uuid, updateUserDto);

      expect(gatewayUsecases.getUserByUuid).toHaveBeenCalledWith(user.uuid);
      expect(gatewayUsecases.updateUser).toHaveBeenCalledWith(
        user,
        updateUserDto.maxSpaceBytes,
      );
      expect(storageNotificationsService.planUpdated).toHaveBeenCalledWith({
        payload: { maxSpaceBytes: updateUserDto.maxSpaceBytes },
        user,
        clientId: 'gateway',
      });
    });

    it('When user is not found, then it should throw.', async () => {
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(null);

      await expect(
        gatewayController.updateUser(user.uuid, updateUserDto),
      ).rejects.toThrow(NotFoundException);

      expect(gatewayUsecases.updateUser).not.toHaveBeenCalled();
      expect(storageNotificationsService.planUpdated).not.toHaveBeenCalled();
    });

    it('When update operation fails, then it should throw.', async () => {
      const error = new Error('Failed to update user');
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(user);
      jest.spyOn(gatewayUsecases, 'updateUser').mockRejectedValueOnce(error);

      await expect(
        gatewayController.updateUser(user.uuid, updateUserDto),
      ).rejects.toThrow(error);
      expect(storageNotificationsService.planUpdated).not.toHaveBeenCalled();
    });

    it('When updating user fails, it should log the error and propagate it', async () => {
      const error = new Error('Failed to update user');
      const errorSpy = jest.spyOn(loggerMock, 'error');
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(user);
      jest.spyOn(gatewayUsecases, 'updateUser').mockRejectedValueOnce(error);

      await expect(
        gatewayController.updateUser(user.uuid, updateUserDto),
      ).rejects.toThrow(error);

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
