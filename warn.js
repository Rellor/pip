// Warnings to Bas's phone: the ntfy topic with "-checkup" at the end (no new secret needed), so they do not mix with
// Pip's own messages (Pip only reads the main topic).

export async function warn(title, body, { tags = 'warning' } = {}) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  for (const t of [`${topic}-checkup`]) {
    try {
      await fetch(`https://ntfy.sh/${encodeURIComponent(t)}`, {
        method: 'POST',
        body,
        // "from-web" keeps Pip from reading this as a message from Bas.
        headers: { Title: title, Tags: `${tags},from-web`, ...(process.env.PIP_SITE_URL ? { Click: process.env.PIP_SITE_URL } : {}) },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      console.error('warning push failed:', e.message);
    }
  }
}
