import { Injectable } from '@nestjs/common';
import { AttemptChangeEmailModel } from './attempt-change-email.model';
import { InjectModel } from '@nestjs/sequelize';
import { AttemptChangeEmailStatus } from './attempt-change-email.attributes';
import { type Transaction } from 'sequelize';

@Injectable()
export class SequelizeAttemptChangeEmailRepository {
  constructor(
    @InjectModel(AttemptChangeEmailModel)
    private readonly model: typeof AttemptChangeEmailModel,
  ) {}

  getOneById(
    id: AttemptChangeEmailModel['id'],
  ): Promise<AttemptChangeEmailModel> {
    return this.model.findOne({ where: { id } });
  }

  create(
    data: Partial<AttemptChangeEmailModel>,
    t?: Transaction,
  ): Promise<AttemptChangeEmailModel> {
    return this.model.create(data, { transaction: t });
  }

  async acceptAttemptChangeEmail(
    id: AttemptChangeEmailModel['id'],
    t?: Transaction,
  ): Promise<void> {
    await this.model.update(
      { status: AttemptChangeEmailStatus.VERIFIED },
      { where: { id }, transaction: t },
    );
  }
}
