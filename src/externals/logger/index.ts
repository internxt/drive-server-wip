import { Logger } from '@nestjs/common';
import { type User } from '../../modules/user/user.domain';

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
export default (method: 'log' | 'error' | 'debug', context: Context) => {
  if (method === 'log') {
    new Logger().log(context);
  } else if (method === 'error') {
    new Logger().error(context);
  } else if (method === 'debug') {
    new Logger().debug(context);
  }
};
