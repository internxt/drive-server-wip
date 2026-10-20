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
  const client = getClientIdFromHeaders(req);
  cls.set('client', KNOWN_CLIENTS.has(client) ? (client as ClientEnum) : null);
  cls.set('version', semver.valid(String(req.headers['internxt-version'])));
};

export const getAsyncLocalStorage = (): AsyncLocalStorageData | null => {
  const cls = ClsServiceManager.getClsService<AsyncLocalStorageData>();
  if (!cls.isActive()) {
    return null;
  }
  return { client: cls.get('client'), version: cls.get('version') };
};
