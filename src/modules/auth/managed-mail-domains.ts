export const MANAGED_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'inxt.eu',
  'inxt.me',
]);

export function isManagedMailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && MANAGED_MAIL_DOMAINS.has(domain);
}
