// Pictures Pip draws, as SVG. They are shown as an image on a wall, and an image can never run code.
// On top of that this keeps only plain shapes and a short list of safe settings, and throws everything else away.

const TAGS = new Set(['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath']);
const ATTRS = new Set(['viewbox', 'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'offset', 'stop-color', 'stop-opacity', 'id', 'gradienttransform', 'gradientunits', 'fx', 'fy', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'clip-path']);
const CAMEL = { viewbox: 'viewBox', gradienttransform: 'gradientTransform', gradientunits: 'gradientUnits', lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' };
const MAX_CHARS = 12_000;
const SAFE_VALUE = /^[\w\s#.,;:%()\-+°'/]*$/; // no < > & " or backslashes

export const MAX_ART_PER_DAY = 3;

// Returns { svg, aspect } or null.
export function cleanSvg(raw) {
  if (typeof raw !== 'string') return null;
  let src = raw.trim();
  if (src.length < 20 || src.length > MAX_CHARS) return null;
  src = src.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  // whole blocks that must never survive
  const BLOCKS = 'script|style|foreignObject|iframe|object|embed|filter|mask|pattern|symbol|marker|title|desc|metadata';
  src = src.replace(new RegExp(`<(${BLOCKS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), ''); // whole blocks, only when they are properly closed
  src = src.replace(new RegExp(`<\\/?(${BLOCKS})\\b[^>]*>`, 'gi'), ''); // leftovers: self-closing or unclosed ones (anything else not on the safe list is dropped below)
  if (!/^<svg[\s>]/i.test(src)) return null;
  let out = '';
  let depth = 0;
  const open = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined) {
      if (open.at(-1) === 'text' || open.at(-1) === 'tspan') out += m[4].replace(/[^\w\s.,!?'\-:;()°]/g, '');
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (!TAGS.has(name)) continue;
    const tag = CAMEL[name] ?? name;
    if (closing) {
      if (open.at(-1) === name) {
        open.pop();
        depth--;
        out += `</${tag}>`;
      }
      continue;
    }
    if (++depth > 12) return null;
    const attrs = [];
    for (const a of m[3].matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const key = a[1].toLowerCase();
      const val = a[2] ?? a[3] ?? '';
      if (!ATTRS.has(key) || !SAFE_VALUE.test(val)) continue;
      if (/url\(/i.test(val) && !/^url\(#[\w-]+\)$/.test(val.trim())) continue; // only links to things inside the picture itself
      attrs.push(`${CAMEL[key] ?? key}="${val}"`);
    }
    const selfClosing = /\/\s*$/.test(m[3]);
    out += `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClosing ? '/>' : '>'}`;
    if (selfClosing) depth--;
    else open.push(name);
  }
  while (open.length) {
    const n = open.pop();
    out += `</${CAMEL[n] ?? n}>`;
  }
  if (!/^<svg[\s>]/.test(out)) return null;
  // the shape of the picture: from its viewBox
  const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(out);
  const w = vb ? Number(vb[1]) : 400;
  const h = vb ? Number(vb[2]) : 300;
  if (!(w > 0 && h > 0)) return null;
  const aspect = Math.round((w / h) * 100) / 100;
  if (aspect < 0.3 || aspect > 3.5) return null;
  let svg = out.replace(/^<svg\b/, `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(800)}" height="${Math.round(800 / aspect)}"${vb ? '' : ' viewBox="0 0 400 300"'}`);
  svg = svg.replace(/(<svg\b[^>]*?)\swidth="[^"]*"([^>]*?)\swidth="[^"]*"/, '$1 width="800"$2'); // one width and height only
  svg = svg.replace(/(<svg\b[^>]*?)\sheight="[^"]*"([^>]*?)\sheight="[^"]*"/, `$1 height="${Math.round(800 / aspect)}"$2`);
  return { svg, aspect };
}
