import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { SequelizeAttemptChangeEmailRepository } from './attempt-change-email.repository';
import { AttemptChangeEmailStatus } from './attempt-change-email.attributes';
import { type Transaction } from 'sequelize';
import { v4 } from 'uuid';

describe('SequelizeAttemptChangeEmailRepository', () => {
  let repository: SequelizeAttemptChangeEmailRepository;
  let attemptChangeEmailModel: typeof AttemptChangeEmailModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeAttemptChangeEmailRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeAttemptChangeEmailRepository>(
      SequelizeAttemptChangeEmailRepository,
    );
    attemptChangeEmailModel = module.get<typeof AttemptChangeEmailModel>(
      getModelToken(AttemptChangeEmailModel),
    );
  });

  describe('getOneById', () => {
    it('When getting attempt by id, then it should return the attempt', async () => {
      const attemptId = 123;
      const mockAttempt = {
        id: attemptId,
        userUuid: v4(),
        newEmail: 'new@example.com',
        status: AttemptChangeEmailStatus.PENDING,
        toJSON: jest.fn().mockReturnValue({
          id: attemptId,
          userUuid: v4(),
          newEmail: 'new@example.com',
          status: AttemptChangeEmailStatus.PENDING,
        }),
      };

      jest
        .spyOn(attemptChangeEmailModel, 'findOne')
        .mockResolvedValueOnce(mockAttempt as any);

      const result = await repository.getOneById(attemptId);

      expect(attemptChangeEmailModel.findOne).toHaveBeenCalledWith({
        where: { id: attemptId },
      });
      expect(result).toEqual(mockAttempt);
    });

    it('When getting attempt by id that does not exist, then it should return null', async () => {
      const attemptId = 999;

      jest
        .spyOn(attemptChangeEmailModel, 'findOne')
        .mockResolvedValueOnce(null);

      const result = await repository.getOneById(attemptId);

      expect(attemptChangeEmailModel.findOne).toHaveBeenCalledWith({
        where: { id: attemptId },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('When creating attempt without transaction, then it should create and return the attempt', async () => {
      const attemptData = {
        userUuid: v4(),
        newEmail: 'new@example.com',
      };
      const createdAttempt = {
        id: 123,
        ...attemptData,
        status: AttemptChangeEmailStatus.PENDING,
        toJSON: jest.fn().mockReturnValue({
          id: 123,
          ...attemptData,
          status: AttemptChangeEmailStatus.PENDING,
        }),
      };

      jest
        .spyOn(attemptChangeEmailModel, 'create')
        .mockResolvedValueOnce(createdAttempt as any);

      const result = await repository.create(attemptData);

      expect(attemptChangeEmailModel.create).toHaveBeenCalledWith(attemptData, {
        transaction: undefined,
      });
      expect(result).toEqual(createdAttempt);
    });

    it('When creating attempt with transaction, then it should create and return the attempt with transaction', async () => {
      const attemptData = {
        userUuid: v4(),
        newEmail: 'new@example.com',
      };
      const transaction = createMock<Transaction>();
      const createdAttempt = {
        id: 123,
        ...attemptData,
        status: AttemptChangeEmailStatus.PENDING,
        toJSON: jest.fn().mockReturnValue({
          id: 123,
          ...attemptData,
          status: AttemptChangeEmailStatus.PENDING,
        }),
      };

      jest
        .spyOn(attemptChangeEmailModel, 'create')
        .mockResolvedValueOnce(createdAttempt as any);

      const result = await repository.create(attemptData, transaction);

      expect(attemptChangeEmailModel.create).toHaveBeenCalledWith(attemptData, {
        transaction,
      });
      expect(result).toEqual(createdAttempt);
    });
  });

  describe('acceptAttemptChangeEmail', () => {
    it('When accepting attempt without transaction, then it should update status to VERIFIED', async () => {
      const attemptId = 123;

      jest
        .spyOn(attemptChangeEmailModel, 'update')
        .mockResolvedValueOnce(undefined);

      await repository.acceptAttemptChangeEmail(attemptId);

      expect(attemptChangeEmailModel.update).toHaveBeenCalledWith(
        { status: AttemptChangeEmailStatus.VERIFIED },
        { where: { id: attemptId }, transaction: undefined },
      );
    });

    it('When accepting attempt with transaction, then it should update status to VERIFIED with transaction', async () => {
      const attemptId = 123;
      const transaction = createMock<Transaction>();

      jest
        .spyOn(attemptChangeEmailModel, 'update')
        .mockResolvedValueOnce(undefined);

      await repository.acceptAttemptChangeEmail(attemptId, transaction);

      expect(attemptChangeEmailModel.update).toHaveBeenCalledWith(
        { status: AttemptChangeEmailStatus.VERIFIED },
        { where: { id: attemptId }, transaction },
      );
    });
  });
});
