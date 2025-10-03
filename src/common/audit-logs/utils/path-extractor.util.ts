/**
 * Extracts a value from an object using a dot-notation path
 */
export function extractByPath(obj: any, path: string): any {
  let result = obj;
  for (const key of path.split('.')) {
    result = result?.[key];
  }
  return result;
}

/**
 * Extracts multiple values from an object using dot-notation paths
 * and returns them as a record
 */
export function extractMultiple(
  obj: any,
  paths: string[],
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const path of paths) {
    const value = extractByPath(obj, path);
    if (value !== undefined) {
      const key = path.split('.').pop() || path;
      result[key] = value;
    }
  }

  return result;
}
