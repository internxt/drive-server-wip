import { Sequelize, SequelizeOptions } from 'sequelize-typescript';
import { WinstonLogger } from '../../../src/lib/winston-logger';
import { format } from 'sql-formatter';
import _ from 'lodash';

export default class Database {
  private static instance: Sequelize;

  static getInstance(config: any): Sequelize {
    if (Database.instance) {
      return Database.instance;
    }

    const logger = WinstonLogger.getLogger();

    const defaultSettings = {
      resetAfterUse: true,
      operatorsAliases: 0,
      pool: {
        maxConnections: Number.MAX_SAFE_INTEGER,
        maxIdleTime: 30000,
        max: 20,
        min: 0,
        idle: 20000,
        acquire: 20000,
      },
      logging: (content: string) => {
        const parse = content.match(/^(Executing \(.*\):) (.*)$/);
        if (parse) {
          const prettySql = format(parse[2]);
          logger.debug(`${parse[1]}\n${prettySql}`);
        } else {
          logger.debug(`Could not parse sql content: ${content}`);
        }
      },
    };

    const sequelizeSettings: SequelizeOptions = _.merge(
      defaultSettings,
      config.sequelizeConfig,
    );

    const instance = new Sequelize(
      config.name,
      config.user,
      config.password,
      sequelizeSettings,
    );

    instance
      .authenticate()
      .then(() => {
        logger.log('Connected to database');
      })
      .catch((err) => {
        logger.error('Database connection error: %s', err);
      });

    Database.instance = instance;

    return instance;
  }
}
