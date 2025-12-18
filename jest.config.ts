import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  roots: ['src', 'test'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  testRegex: '.*\\.spec\\.ts$',
  transformIgnorePatterns: ['node_modules/(?!@serenity-kit/opaque)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

export default config;
