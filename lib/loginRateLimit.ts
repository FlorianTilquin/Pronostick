const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

// En memoire : suffisant car le serveur standalone est un seul processus,
// et un redemarrage du conteneur remet simplement les compteurs a zero.
const failuresByUsername = new Map<string, number[]>();

function recentFailures(key: string) {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = (failuresByUsername.get(key) ?? []).filter((at) => at > cutoff);
  if (recent.length) {
    failuresByUsername.set(key, recent);
  } else {
    failuresByUsername.delete(key);
  }
  return recent;
}

export function loginBlockedMinutes(username: string) {
  const recent = recentFailures(username.toLowerCase());
  if (recent.length < MAX_FAILURES) return 0;
  const oldest = recent[0] ?? Date.now();
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60_000));
}

export function recordLoginFailure(username: string) {
  const key = username.toLowerCase();
  failuresByUsername.set(key, [...recentFailures(key), Date.now()]);
}

export function clearLoginFailures(username: string) {
  failuresByUsername.delete(username.toLowerCase());
}
