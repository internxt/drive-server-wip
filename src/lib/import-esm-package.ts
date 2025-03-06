/**
 * Dynamically imports an ESM package in a CommonJS NestJS project,
 * avoiding TypeScript transpilation to `require()`, which ESM packages do not support.
 */
export const importEsmPackage = async <ReturnType>(
  packageName: string,
): Promise<ReturnType> =>
  new Function(`return import('${packageName}')`)().then(
    (loadedModule: unknown) => loadedModule['default'] ?? loadedModule,
  );
