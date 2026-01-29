import { Sequelize, Transaction } from 'sequelize';

export async function withQueryTimeout<T>(
  sequelize: Sequelize,
  timeoutMs: number,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`, {
        transaction,
      });
      return callback(transaction);
    });
  } catch (error) {
    if (error.original?.code === '57014') {
      throw new Error('Query timed out');
    }
    throw error;
  }
}
