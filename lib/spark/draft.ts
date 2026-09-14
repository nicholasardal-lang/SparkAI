const key = "spark-starting-idea";
export type StartingIdea = { content: string; created: number; projectId?: string };
export function readIdea(): StartingIdea | null {
  try {
    const idea = JSON.parse(sessionStorage.getItem(key) || "null");
    return idea && typeof idea.content === "string" && idea.content.trim() && idea.content.length <= 8000 && Number.isFinite(idea.created) && Date.now() - idea.created < 86400000 ? idea : null;
  } catch { return null; }
}
export function saveIdea(content: string, projectId?: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ content: content.trim(), created: Date.now(), projectId }));
    return true;
  } catch { return false; }
}
export function clearIdea() {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}
