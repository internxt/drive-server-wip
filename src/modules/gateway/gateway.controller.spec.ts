import { type DeleteWorkspaceDto } from './dto/delete-workspace.dto';
import { type UpdateWorkspaceStorageDto } from './dto/update-workspace-storage.dto';
import { type UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { type InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { GatewayUseCases } from './gateway.usecase';
import { GatewayController } from './gateway.controller';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  type Logger,
  NotFoundException,
} from '@nestjs/common';
import { newFeatureLimit, newUser, newWorkspace } from '../../../test/fixtures';
import { v4 } from 'uuid';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Test } from '@nestjs/testing';
import { UserLimitResponseDto } from './dto/user-limit-response.dto';

describe('Gateway Controller', () => {
  let gatewayController: GatewayController;
  let gatewayUsecases: DeepMocked<GatewayUseCases>;
  let storageNotificationsService: DeepMocked<StorageNotificationService>;
  let loggerMock: DeepMocked<Logger>;

  beforeEach(async () => {
    loggerMock = createMock<Logger>();
    const moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [],
      providers: [GatewayController],
    })
      .setLogger(loggerMock)
      .useMocker(() => createMock())
      .compile();

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
    const updateUserWithTierDto = {
      maxSpaceBytes: 3000000,
      tierId: v4(),
    };

    it('When user is found and updated without tier successfully, then it should send notification', async () => {
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(user);

      await gatewayController.updateUser(user.uuid, updateUserDto);

      expect(gatewayUsecases.getUserByUuid).toHaveBeenCalledWith(user.uuid);
      expect(gatewayUsecases.updateUser).toHaveBeenCalledWith(user, {
        newStorageSpaceBytes: updateUserDto.maxSpaceBytes,
        newTierId: undefined,
      });
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

    it('When user is found and updated with tierId successfully, then it should send notification', async () => {
      jest.spyOn(gatewayUsecases, 'getUserByUuid').mockResolvedValueOnce(user);

      await gatewayController.updateUser(user.uuid, updateUserWithTierDto);

      expect(gatewayUsecases.getUserByUuid).toHaveBeenCalledWith(user.uuid);
      expect(gatewayUsecases.updateUser).toHaveBeenCalledWith(user, {
        newStorageSpaceBytes: updateUserWithTierDto.maxSpaceBytes,
        newTierId: updateUserWithTierDto.tierId,
      });
      expect(storageNotificationsService.planUpdated).toHaveBeenCalledWith({
        payload: { maxSpaceBytes: updateUserWithTierDto.maxSpaceBytes },
        user,
        clientId: 'gateway',
      });
    });
  });

  describe('POST /users/failed-payment', () => {
    const failedPaymentDto = {
      userId: '87204d6b-c4a7-4f38-bd99-f7f47964a643',
    };

    it('When failed payment is handled successfully, then return success', async () => {
      const mockResponse = { success: true };
      jest
        .spyOn(gatewayUsecases, 'handleFailedPayment')
        .mockResolvedValueOnce(mockResponse);

      const result =
        await gatewayController.handleFailedPayment(failedPaymentDto);

      expect(result).toStrictEqual(mockResponse);
      expect(gatewayUsecases.handleFailedPayment).toHaveBeenCalledWith(
        failedPaymentDto.userId,
      );
    });

    it('When mailer service throws error, then it should propagate', async () => {
      const error = new Error('Email sending failed');
      jest
        .spyOn(gatewayUsecases, 'handleFailedPayment')
        .mockRejectedValueOnce(error);

      await expect(
        gatewayController.handleFailedPayment(failedPaymentDto),
      ).rejects.toThrow(error);

      expect(gatewayUsecases.handleFailedPayment).toHaveBeenCalledWith(
        failedPaymentDto.userId,
      );
    });
  });

  describe('PATCH /workspaces', () => {
    const ownerId = v4();
    const tierId = v4();

    it('When updating workspace with tier only, then it should update the workspace tier', async () => {
      const updateWorkspaceTierOnlyDto: UpdateWorkspaceDto = {
        ownerId,
        tierId,
      };
      await gatewayController.updateWorkspace(updateWorkspaceTierOnlyDto);

      expect(gatewayUsecases.updateWorkspace).toHaveBeenCalledWith(ownerId, {
        tierId,
        maxSpaceBytes: undefined,
        numberOfSeats: undefined,
      });
    });

    it('When updating workspace with storage and seats only, then it should call update the workspace storage and seats', async () => {
      const updateWorkspaceStorageAndSeatsDto: UpdateWorkspaceDto = {
        ownerId,
        maxSpaceBytes: 5000000,
        numberOfSeats: 10,
      };
      await gatewayController.updateWorkspace(
        updateWorkspaceStorageAndSeatsDto,
      );

      expect(gatewayUsecases.updateWorkspace).toHaveBeenCalledWith(ownerId, {
        tierId: undefined,
        maxSpaceBytes: updateWorkspaceStorageAndSeatsDto.maxSpaceBytes,
        numberOfSeats: updateWorkspaceStorageAndSeatsDto.numberOfSeats,
      });
    });

    it('When updating workspace with all fields, then it should call updateWorkspace with correct parameters', async () => {
      const updateWorkspaceAllFieldsDto: UpdateWorkspaceDto = {
        ownerId,
        tierId,
        maxSpaceBytes: 8000000,
        numberOfSeats: 15,
      };
      await gatewayController.updateWorkspace(updateWorkspaceAllFieldsDto);

      expect(gatewayUsecases.updateWorkspace).toHaveBeenCalledWith(ownerId, {
        tierId: updateWorkspaceAllFieldsDto.tierId,
        maxSpaceBytes: updateWorkspaceAllFieldsDto.maxSpaceBytes,
        numberOfSeats: updateWorkspaceAllFieldsDto.numberOfSeats,
      });
    });
  });

  describe('GET /users/:uuid/limits/overrides', () => {
    const userUuid = v4();
    const mockLimits = [newFeatureLimit(), newFeatureLimit()];

    it('When user has limit overrides, then it should return them', async () => {
      jest
        .spyOn(gatewayUsecases, 'getUserLimitOverrides')
        .mockResolvedValueOnce(mockLimits);

      const result = await gatewayController.getUserLimitOverrides(userUuid);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(new UserLimitResponseDto({ ...mockLimits[0] }));
      expect(result[1]).toEqual(new UserLimitResponseDto({ ...mockLimits[1] }));
      expect(gatewayUsecases.getUserLimitOverrides).toHaveBeenCalledWith(
        userUuid,
      );
    });
  });
});
