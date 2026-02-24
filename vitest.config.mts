import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/vitest.setup.ts'],
    exclude: ['node_modules', 'dist'],
    include: [
      'src/**/*.spec.{ts,tsx,js,jsx}',
      'test/**/*.spec.{ts,tsx,js,jsx}',
      'src/**/*.e2e-spec.{ts,tsx,js,jsx}',
      'test/**/*.e2e-spec.{ts,tsx,js,jsx}',
    ],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov'],
      include: [
        'src/**/*.{js,ts,jsx,tsx}',
        'test/**/*.{js,ts,jsx,tsx}'
      ],
      exclude: [
        ...coverageConfigDefaults.exclude
      ]
    },
    mockReset: true
  },
});
