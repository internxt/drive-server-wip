import { type FactoryProvider } from '@nestjs/common';
import { importEsmPackage } from '../../../lib/import-esm-package';
import type { KEM } from '@dashlane/pqc-kem-kyber512-node';

export type KyberBuilder = KEM;

export const KyberProvider: FactoryProvider<KyberBuilder> = {
  provide: 'Kyber',
  useFactory: async (): Promise<KyberBuilder> => {
    const kemBuilder = await importEsmPackage<
      typeof import('@dashlane/pqc-kem-kyber512-node').default
    >('@dashlane/pqc-kem-kyber512-node');

    const kemInstance = await kemBuilder();

    return kemInstance;
  },
};
