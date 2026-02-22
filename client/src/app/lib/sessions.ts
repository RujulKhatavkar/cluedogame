// client/src/app/lib/session.ts
export function getSessionId() {
  const key = "cluefinder.sessionId";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      (globalThis.crypto as any)?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id!);
  }
  return id;
}

export function persistIdentity(name: string, avatar: string) {
  sessionStorage.setItem("playerName", name);
  sessionStorage.setItem("playerAvatar", avatar);
  localStorage.setItem("playerName", name);
  localStorage.setItem("playerAvatar", avatar);
}

export function getPersistedIdentity() {
  const name =
    sessionStorage.getItem("playerName") ||
    localStorage.getItem("playerName") ||
    "";
  const avatar =
    sessionStorage.getItem("playerAvatar") ||
    localStorage.getItem("playerAvatar") ||
    "detective";
  return { name, avatar };
}