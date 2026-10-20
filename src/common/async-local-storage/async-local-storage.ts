import { ClsServiceManager, type ClsService, type ClsStore } from 'nestjs-cls';
import * as semver from 'semver';
import { getClientIdFromHeaders } from '../decorators/client.decorator';
import { ClientEnum } from '../enums/platform.enum';

export interface AsyncLocalStorageData extends ClsStore {
  client: ClientEnum | null;
  version: string | null;
}

const KNOWN_CLIENTS = new Set<string>(Object.values(ClientEnum));

export const initAsyncLocalStorage = (
  cls: ClsService<AsyncLocalStorageData>,
  req: Request,
) => {
  // Rclone does not send internxt headers, its version comes in the user agent (rclone/v1.73.0)
  const userAgent = String(req.headers['user-agent'] ?? '');
  const isRclone = userAgent.startsWith('rclone/');
  const client = isRclone ? ClientEnum.Rclone : getClientIdFromHeaders(req);
  cls.set('client', KNOWN_CLIENTS.has(client) ? (client as ClientEnum) : null);
  const rawVersion = isRclone ? userAgent : req.headers['internxt-version'];
  const version = rawVersion
    ? semver.valid(semver.coerce(String(rawVersion)))
    : null;
  cls.set('version', version);
};

export const getAsyncLocalStorage = (): AsyncLocalStorageData | null => {
  const cls = ClsServiceManager.getClsService<AsyncLocalStorageData>();
  if (!cls.isActive()) {
    return null;
  }
  return { client: cls.get('client'), version: cls.get('version') };
};
