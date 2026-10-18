import { type Sequelize } from 'sequelize';
import { withQueryTimeout } from './query-timeout';

describe('withQueryTimeout', () => {
  const transaction = {};
  let sequelize: { transaction: jest.Mock; query: jest.Mock };

  beforeEach(() => {
    sequelize = {
      transaction: jest.fn((_options, cb) => cb(transaction)),
      query: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('When called, then it should set the statement timeout inside the transaction and return the callback result', async () => {
    const result = await withQueryTimeout(
      sequelize as unknown as Sequelize,
      1000,
      async () => 'result',
    );

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('1000ms'),
      { transaction },
    );
    expect(result).toBe('result');
  });

  test('When read-only is requested, then it should open a read-only transaction', async () => {
    await withQueryTimeout(
      sequelize as unknown as Sequelize,
      1000,
      async () => undefined,
      { readOnly: true },
    );

    expect(sequelize.transaction).toHaveBeenCalledWith(
      { readOnly: true },
      expect.any(Function),
    );
  });

  test('When the statement is cancelled by the timeout, then it should throw a query timeout error', async () => {
    sequelize.transaction.mockRejectedValueOnce({
      original: { code: '57014' },
    });

    await expect(
      withQueryTimeout(
        sequelize as unknown as Sequelize,
        1000,
        async () => undefined,
      ),
    ).rejects.toThrow('Query timed out');
  });
});
