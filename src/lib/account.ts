/**
 * Supabase identifies accounts by email, but this app signs in with a username.
 *
 * A bare username is expanded against a domain that receives no mail, so there
 * is no mailbox to own and nothing is ever sent. Entering a full address works
 * too and is used verbatim, which keeps an account created with a real email
 * reachable.
 */

export const USERNAME_DOMAIN = 'jobtracker.local';

export function toAccountEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (!u) return '';
  return u.includes('@') ? u : `${u}@${USERNAME_DOMAIN}`;
}
