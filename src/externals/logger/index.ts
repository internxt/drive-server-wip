import { Logger } from '@nestjs/common';
import { User } from '../../modules/user/user.domain';

export enum LogType {
  Error = 'error',
  Info = 'info',
  Debug = 'debug',
}

type Context = {
  user: User['uuid'];
  id: string;
  message?: string;
  entity?: Record<string, unknown>;
};
/**
 * Adds a log to the server
 * @param method Log method to use
 * @param context Context to log
 */
export default (method: LogType, context: Context) => {
  if (method === LogType.Info) {
    new Logger().log(context);
  } else if (method === LogType.Error) {
    new Logger().error(context);
  } else if (method === LogType.Debug) {
    new Logger().debug(context);
  }
};
