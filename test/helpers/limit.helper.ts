import { type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { v4 } from 'uuid';
import { Limitmodel } from '../../src/modules/feature-limit/models/limit.model';
import { UserOverriddenLimitModel } from '../../src/modules/feature-limit/models/user-overridden-limit.model';
import {
  type LimitLabels,
  type LimitTypes,
} from '../../src/modules/feature-limit/limits.enum';

export interface OverrideUserLimitOptions {
  userUuid: string;
  label: LimitLabels;
  type: LimitTypes;
  value: string;
}

export async function overrideUserLimit(
  app: INestApplication,
  { userUuid, label, type, value }: OverrideUserLimitOptions,
): Promise<void> {
  const limitModel: typeof Limitmodel = app.get(getModelToken(Limitmodel));
  const userOverriddenLimitModel: typeof UserOverriddenLimitModel = app.get(
    getModelToken(UserOverriddenLimitModel),
  );

  const limit = await limitModel.create({ id: v4(), label, type, value });
  await userOverriddenLimitModel.create({
    id: v4(),
    userId: userUuid,
    limitId: limit.id,
  });
}

export async function removeUserLimitOverrides(
  app: INestApplication,
  userUuid: string,
): Promise<void> {
  const limitModel: typeof Limitmodel = app.get(getModelToken(Limitmodel));
  const userOverriddenLimitModel: typeof UserOverriddenLimitModel = app.get(
    getModelToken(UserOverriddenLimitModel),
  );

  const overrides = await userOverriddenLimitModel.findAll({
    where: { userId: userUuid },
  });
  if (overrides.length === 0) {
    return;
  }

  await userOverriddenLimitModel.destroy({ where: { userId: userUuid } });
  await limitModel.destroy({
    where: { id: overrides.map((override) => override.limitId) },
  });
}
