import { Sequelize } from 'sequelize';
import { getAssociations, type ModelCtor } from 'sequelize-typescript';
import { FileModel } from '../modules/file/file.model';
import { FolderModel } from '../modules/folder/folder.model';
import {
  canConnectToHeavyReadPool,
  heavyReadPoolModels,
} from './heavy-read-pool-connection';

const collectReachableModels = (roots: ModelCtor[]): Set<ModelCtor> => {
  const visited = new Set<ModelCtor>();
  const pending = [...roots];

  while (pending.length) {
    const model = pending.pop();
    if (visited.has(model)) {
      continue;
    }
    visited.add(model);

    for (const association of getAssociations(model.prototype) ?? []) {
      pending.push(association.getAssociatedClass() as ModelCtor);

      const through = (association as any).options?.through;
      const throughModel =
        typeof through === 'object' ? through.model : through;
      if (typeof throughModel === 'function') {
        pending.push(throughModel());
      }
    }
  }

  return visited;
};

describe('heavyReadPoolModels', () => {
  it('When walking FileModel and FolderModel associations, then every reachable model should be registered', () => {
    const reachableModels = collectReachableModels([FileModel, FolderModel]);

    const missingModels = [...reachableModels]
      .filter((model) => !heavyReadPoolModels.includes(model as any))
      .map((model) => model.name);

    expect(missingModels).toEqual([]);
  });
});

describe('canConnectToHeavyReadPool', () => {
  const uri = 'postgres://user:pass@host:6432/db';

  beforeEach(() => {
    jest.spyOn(Sequelize.prototype, 'close').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When the pool is reachable, then it should return true and close the connection', async () => {
    jest.spyOn(Sequelize.prototype, 'authenticate').mockResolvedValue();

    const result = await canConnectToHeavyReadPool(uri, {});

    expect(result).toBe(true);
    expect(Sequelize.prototype.close).toHaveBeenCalled();
  });

  it('When the pool is not reachable, then it should return false and close the connection', async () => {
    jest
      .spyOn(Sequelize.prototype, 'authenticate')
      .mockRejectedValue(
        new Error('self-signed certificate in certificate chain'),
      );

    const result = await canConnectToHeavyReadPool(uri, {});

    expect(result).toBe(false);
    expect(Sequelize.prototype.close).toHaveBeenCalled();
  });
});
