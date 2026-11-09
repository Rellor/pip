// Messages from Bas can arrive two ways: from the web chat (small files in inbox/) or typed in the ntfy app.
// This file holds the shared, checkable parts: recognising pictures and reading the ntfy topic.

export const MAX_PICTURE_BYTES = 2_500_000;

// Only real JPEG or PNG files count as pictures. Returns { ext, mime } or null.
export function pictureType(bytes) {
  if (!bytes || bytes.length < 8 || bytes.length > MAX_PICTURE_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  return null;
}

// Reads the messages on the ntfy topic (poll mode: it answers and closes).
export async function ntfyPoll(topic, since = 'all', fetchFn = fetch) {
  const url = (s) => `https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=${encodeURIComponent(s)}`;
  let res = await fetchFn(url(since), { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'PipCharacter/0.1' } });
  if (!res.ok && since !== 'all') res = await fetchFn(url('12h'), { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'PipCharacter/0.1' } }); // the remembered id may have expired
  if (!res.ok) throw new Error(`ntfy answered ${res.status}`);
  const events = [];
  for (const line of (await res.text()).split('\n')) {
    try {
      const e = JSON.parse(line);
      if (e && e.event === 'message') events.push(e);
    } catch {}
  }
  return events;
}

// Pip's own pushes carry the tag "speech_balloon". Messages the website mirrors to ntfy carry "from-web".
// Everything else was typed by Bas in the ntfy app.
export function isFromBas(e) {
  const tags = Array.isArray(e?.tags) ? e.tags : [];
  return !tags.includes('speech_balloon') && !tags.includes('from-web') && Boolean(e?.message || e?.attachment);
}

// The text of an ntfy message, without the file name ntfy puts there when only a file was sent.
export function ntfyText(e) {
  const m = String(e?.message ?? '').trim();
  const name = e?.attachment?.name;
  return (m && m !== name ? m : '').slice(0, 1000);
}

// A picture attached in the ntfy app. Only files that ntfy.sh itself hosts are downloaded.
export function attachmentUrl(e) {
  const a = e?.attachment;
  if (!a || !/^image\/(jpeg|png)$/.test(String(a.type))) return null;
  try {
    const u = new URL(a.url);
    return u.protocol === 'https:' && u.hostname === 'ntfy.sh' ? u.href : null;
  } catch {
    return null;
  }
}

export async function downloadAttachment(e, fetchFn = fetch) {
  const url = attachmentUrl(e);
  if (!url) return null;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return pictureType(bytes) ? bytes : null;
}

// Width and height of a JPEG or PNG, read from its header. Used to frame it with the right shape.
export function pictureSize(bytes) {
  const type = pictureType(bytes);
  if (!type) return null;
  if (type.ext === 'png') {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}
