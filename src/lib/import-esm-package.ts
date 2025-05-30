/**
 * Dynamically imports an ESM package in a CommonJS NestJS project,
 * avoiding TypeScript transpilation to `require()`, which ESM packages do not support.
 */

export const importEsmPackage = async <ReturnType>(
  packageName: string,
): Promise<ReturnType> => {
  try {
    const modulePromise = eval(`import('${packageName}')`);
    const module = await modulePromise;

    return (module.default || module) as ReturnType;
  } catch (error) {
    console.error(`Error importing ESM package ${packageName}:`, error);
    throw error;
  }
};
