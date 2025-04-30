export function isNumber(n: any) {
  return !Number.isNaN(parseInt(n.toString()));
}

export const isStringEmpty = (str: string | null | undefined) =>
  !(typeof str === 'string' && str?.trim().length > 0);
