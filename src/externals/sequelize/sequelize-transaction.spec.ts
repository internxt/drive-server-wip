import { SequelizeTransactionAdapter } from './sequelize-transaction';
import { Transaction as SequelizeTransaction } from 'sequelize';

describe('SequelizeTransactionAdapter', () => {
  let sequelizeTransactionMock: jest.Mocked<SequelizeTransaction>;
  let transactionAdapter: SequelizeTransactionAdapter;

  beforeEach(() => {
    sequelizeTransactionMock = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SequelizeTransaction>;

    transactionAdapter = new SequelizeTransactionAdapter(
      sequelizeTransactionMock,
    );
  });

  it('should commit the transaction', async () => {
    await transactionAdapter.commit();
    expect(sequelizeTransactionMock.commit).toHaveBeenCalled();
  });

  it('should rollback the transaction', async () => {
    await transactionAdapter.rollback();
    expect(sequelizeTransactionMock.rollback).toHaveBeenCalled();
  });

  it('should return the sequelize transaction', () => {
    const result = transactionAdapter.getSequelizeTransaction();
    expect(result).toBe(sequelizeTransactionMock);
  });
});
