import { Transaction as SequelizeTransaction } from 'sequelize/types';

export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getSequelizeTransaction?(): SequelizeTransaction;
}

export class SequelizeTransactionAdapter implements Transaction {
  constructor(private readonly sequelizeTransaction: SequelizeTransaction) {}

  commit(): Promise<void> {
    return this.sequelizeTransaction.commit();
  }

  rollback(): Promise<void> {
    return this.sequelizeTransaction.rollback();
  }

  getSequelizeTransaction(): SequelizeTransaction {
    return this.sequelizeTransaction;
  }
}
