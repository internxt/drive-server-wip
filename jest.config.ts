import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',

  testEnvironment: 'node',

  extensionsToTreatAsEsm: ['.ts'],

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  transformIgnorePatterns: ['/node_modules/(?!(?:@serenity-kit/opaque)/)'],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

export default config;
