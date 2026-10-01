export interface OpenmojiItem {
  hexcode: string;
  emoji: string;
  nameHe?: string;
  nameEn: string;
  keywords: string[];
}

interface RawOpenmoji {
  emoji: string;
  hexcode: string;
  group: string;
  annotation: string;
  tags: string;
  openmoji_tags: string;
  skintone: string;
}

type CldrAnnotations = Record<string, { default?: string[]; tts?: string[] }>;

const CDN = 'https://cdn.jsdelivr.net/npm/';
const CATALOG_URL = CDN + 'openmoji@17.0.0/data/openmoji.json';
const HE_URL = CDN + 'cldr-annotations-full@48.2.0/annotations/he/annotations.json';
const HE_DERIVED_URL = CDN + 'cldr-annotations-derived-full@48.2.0/annotationsDerived/he/annotations.json';

export const openmojiSvgUrl = (hexcode: string) => `${CDN}openmoji@17.0.0/color/svg/${hexcode}.svg`;

const stripVs = (s: string) => s.replace(/\uFE0F/g, '');
const splitTags = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function buildIndex(): Promise<OpenmojiItem[]> {
  const [catalog, he, heDerived] = await Promise.all([
    getJson<RawOpenmoji[]>(CATALOG_URL),
    getJson<{ annotations: { annotations: CldrAnnotations } }>(HE_URL),
    getJson<{ annotationsDerived: { annotations: CldrAnnotations } }>(HE_DERIVED_URL),
  ]);
  const hebrew = new Map<string, { default?: string[]; tts?: string[] }>();
  for (const src of [he.annotations.annotations, heDerived.annotationsDerived.annotations]) {
    for (const [k, v] of Object.entries(src)) hebrew.set(stripVs(k), v);
  }

  return catalog
    .filter((e) => !e.skintone && e.group !== 'component')
    .map((e) => {
      const h = hebrew.get(stripVs(e.emoji));
      const nameHe = h?.tts?.[0];
      const words = [
        ...(h?.tts ?? []),
        ...(h?.default ?? []),
        e.annotation,
        ...splitTags(e.tags),
        ...splitTags(e.openmoji_tags),
      ];
      return {
        hexcode: e.hexcode,
        emoji: e.emoji,
        nameHe,
        nameEn: e.annotation,
        keywords: [...new Set(words.map((w) => w.toLowerCase()))],
      };
    });
}

let indexPromise: Promise<OpenmojiItem[]> | undefined;

/** Download (once) and index the OpenMoji catalog with Hebrew CLDR names. */
export function loadOpenmojiIndex(): Promise<OpenmojiItem[]> {
  indexPromise ??= buildIndex().catch((err) => {
    indexPromise = undefined;
    throw err;
  });
  return indexPromise;
}

/** Rank: exact name, exact keyword, name prefix, keyword prefix, substring; name containing q breaks ties. */
function score(item: OpenmojiItem, q: string): number {
  const names = [item.nameHe, item.nameEn.toLowerCase()];
  if (names.includes(q)) return 0;
  const tie = names.some((n) => n?.includes(q)) ? 0 : 0.5;
  if (item.keywords.includes(q)) return 1 + tie;
  if (names.some((n) => n?.startsWith(q))) return 2;
  if (item.keywords.some((k) => k.startsWith(q) || k.includes(' ' + q))) return 3 + tie;
  if (item.keywords.some((k) => k.includes(q))) return 4 + tie;
  return -1;
}

export function searchOpenmoji(index: OpenmojiItem[], query: string, limit = 120): OpenmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { item: OpenmojiItem; s: number; i: number }[] = [];
  index.forEach((item, i) => {
    const s = score(item, q);
    if (s >= 0) hits.push({ item, s, i });
  });
  hits.sort((a, b) => a.s - b.s || a.i - b.i);
  return hits.slice(0, limit).map((h) => h.item);
}
