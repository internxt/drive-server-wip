import { Injectable } from '@nestjs/common';
import { AppSumoModel } from './app-sumo.model';
import { AppSumoNotFoundException } from './exception/app-sumo-not-found.exception';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class SequelizeAppSumoRepository {
  constructor(
    @InjectModel(AppSumoModel)
    private readonly appSumoModel: typeof AppSumoModel,
  ) {}

  /**
   *
   * @param appSumo {Partial<AppSumoModel>}
   * @returns {AppSumoModel}
   */
  public async getOneBy(appSumo: Partial<AppSumoModel>): Promise<AppSumoModel> {
    const item = await this.appSumoModel.findOne({ where: appSumo });

    if (!item) {
      throw new AppSumoNotFoundException();
    }

    return item;
  }
}
