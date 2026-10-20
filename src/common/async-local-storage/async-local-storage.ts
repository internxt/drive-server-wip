import { ClsServiceManager, type ClsService, type ClsStore } from 'nestjs-cls';
import * as semver from 'semver';
import { getClientIdFromHeaders } from '../decorators/client.decorator';
import { ClientEnum } from '../enums/platform.enum';

export interface AsyncLocalStorageData extends ClsStore {
  client: ClientEnum | null;
  version: string | null;
}

const KNOWN_CLIENTS = new Set<string>(Object.values(ClientEnum));
const RCLONE_USER_AGENT_PREFIX = 'rclone/';

const parseVersion = (rawVersion: unknown): string | null =>
  rawVersion ? semver.valid(semver.coerce(String(rawVersion))) : null;

export const initAsyncLocalStorage = (
  cls: ClsService<AsyncLocalStorageData>,
  req: Request,
) => {
  const client = getClientIdFromHeaders(req);
  if (KNOWN_CLIENTS.has(client)) {
    cls.set('client', client as ClientEnum);
    cls.set('version', parseVersion(req.headers['internxt-version']));
    return;
  }

  // Rclone does not send internxt-client, its version comes in the user agent (rclone/v1.73.0)
  const userAgent = String(req.headers['user-agent'] ?? '');
  if (userAgent.startsWith(RCLONE_USER_AGENT_PREFIX)) {
    cls.set('client', ClientEnum.Rclone);
    cls.set(
      'version',
      parseVersion(userAgent.slice(RCLONE_USER_AGENT_PREFIX.length)),
    );
    return;
  }

  cls.set('client', null);
  cls.set('version', parseVersion(req.headers['internxt-version']));
};

export const getAsyncLocalStorage = (): AsyncLocalStorageData | null => {
  const cls = ClsServiceManager.getClsService<AsyncLocalStorageData>();
  if (!cls.isActive()) {
    return null;
  }
  return { client: cls.get('client'), version: cls.get('version') };
};
