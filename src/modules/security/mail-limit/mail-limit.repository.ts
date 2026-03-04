import { InjectModel } from '@nestjs/sequelize';
import { Injectable } from '@nestjs/common';

import {
  MailLimitModel,
  type MailLimitModelAttributes,
} from './mail-limit.model';
import { MailLimit } from './mail-limit.domain';
import { type MailTypes } from './mailTypes';

@Injectable()
export class SequelizeMailLimitRepository {
  constructor(
    @InjectModel(MailLimitModel)
    private readonly mailLimitModel: typeof MailLimitModel,
  ) {}

  async findOrCreate(
    where: Partial<MailLimitModelAttributes>,
    defaults: Partial<MailLimitModelAttributes>,
  ): Promise<[MailLimit, boolean]> {
    const [mailLimit, wasCreated] = await this.mailLimitModel.findOrCreate({
      where,
      defaults,
    });
    return [mailLimit ? this.toDomain(mailLimit) : null, wasCreated];
  }

  async findByUserIdAndMailType(
    userId: MailLimitModelAttributes['userId'],
    mailType: MailTypes,
  ): Promise<MailLimit> {
    const mailLimit = await this.mailLimitModel.findOne({
      where: { userId, mailType },
    });
    return mailLimit ? this.toDomain(mailLimit) : null;
  }

  async updateByUserIdAndMailType(
    userId: MailLimitModelAttributes['userId'],
    mailType: MailTypes,
    update: Partial<MailLimit>,
  ): Promise<void> {
    await this.mailLimitModel.update(update, {
      where: {
        userId,
        mailType,
      },
    });
  }

  private toDomain(model: MailLimitModel): MailLimit {
    return MailLimit.build({
      ...model.toJSON(),
    });
  }
}
