import type { Gender } from '@super-project/types';
import { dateSortKey } from './dates';
import type { FamilyIndex } from './graph';

/**
 * Mongolian kinship terms. Usage differs between regions and families; the terms
 * here follow the most common modern usage, with the traditional term where one exists.
 */
export type KinCategory = 'self' | 'blood' | 'partner' | 'in-law' | 'step' | 'relative' | 'none';

export interface Kinship {
  /** stable key, e.g. "paternal-uncle" */
  key: string;
  mn: string;
  en: string;
  category: KinCategory;
  /** generations from `from` up to the common ancestor (blood relations) */
  up?: number;
  /** generations from the common ancestor down to `to` */
  down?: number;
}

interface Blood {
  up: number;
  down: number;
  ancestor: string;
}

type Term = { mn: string; en: string };
const t = (mn: string, en: string): Term => ({ mn, en });

function byGender(g: Gender | undefined, male: Term, female: Term, neutral: Term): Term {
  return g === 'male' ? male : g === 'female' ? female : neutral;
}

/** true if a is older than b, false if younger, null when unknown */
function isOlder(idx: FamilyIndex, a: string, b: string): boolean | null {
  const ka = dateSortKey(idx.get(a)?.birthDate);
  const kb = dateSortKey(idx.get(b)?.birthDate);
  if (ka == null || kb == null || ka === kb) return null;
  return ka < kb;
}

function ordinalEn(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function bloodRelation(idx: FamilyIndex, from: string, to: string): Blood | null {
  const a = idx.ancestorDepths(from);
  const b = idx.ancestorDepths(to);
  let best: Blood | null = null;
  for (const [id, up] of a) {
    const down = b.get(id);
    if (down == null) continue;
    if (!best || up + down < best.up + best.down || (up + down === best.up + best.down && up < best.up)) {
      best = { up, down, ancestor: id };
    }
  }
  return best;
}

/** First step from `person` toward `ancestor` (the lineage parent on the path). */
function stepToward(idx: FamilyIndex, person: string, ancestor: string, depth: number): string | undefined {
  if (depth <= 0) return undefined;
  return idx.lineageParents(person).find((p) => idx.ancestorDepths(p).get(ancestor) === depth - 1);
}

/** The child of `ancestor` on the path down to `descendant`. */
function childToward(idx: FamilyIndex, ancestor: string, descendant: string, depth: number): string | undefined {
  const depths = idx.ancestorDepths(descendant);
  return idx.lineageChildren(ancestor).find((c) => depths.get(c) === depth - 1);
}

function bloodTerm(idx: FamilyIndex, from: string, to: string, rel: Blood): Kinship | null {
  const { up, down } = rel;
  const target = idx.get(to);
  const g = target?.gender;
  const k = (key: string, term: Term): Kinship => ({ key, ...term, category: 'blood', up, down });

  // Descendants
  if (up === 0) {
    if (down === 1) {
      const link = idx.parents(to).find((p) => p.id === from);
      if (link?.type === 'adoptive') {
        return k('adopted-child', byGender(g, t('өргөмөл хүү', 'adopted son'), t('өргөмөл охин', 'adopted daughter'), t('өргөмөл хүүхэд', 'adopted child')));
      }
      return k('child', byGender(g, t('хүү', 'son'), t('охин', 'daughter'), t('хүүхэд', 'child')));
    }
    if (down === 2) {
      const via = childToward(idx, from, to, down);
      const viaDaughter = idx.get(via ?? '')?.gender === 'female';
      const en = byGender(g, t('', 'grandson'), t('', 'granddaughter'), t('', 'grandchild')).en;
      return k(viaDaughter ? 'grandchild-daughter-line' : 'grandchild-son-line', t(viaDaughter ? 'зээ' : 'ач', en));
    }
    if (down === 3) return k('great-grandchild', t('гуч', byGender(g, t('', 'great-grandson'), t('', 'great-granddaughter'), t('', 'great-grandchild')).en));
    const greats = down - 2;
    return k(`descendant-${down}`, t(`${down}-р үеийн үр удам`, `${greats}× great-grandchild`));
  }

  // Ancestors
  if (down === 0) {
    const firstStep = stepToward(idx, from, to, up);
    const maternal = idx.get(firstStep ?? '')?.gender === 'female';
    if (up === 1) {
      const link = idx.parents(from).find((p) => p.id === to);
      if (link?.type === 'adoptive') {
        return k('adoptive-parent', byGender(g, t('өргөмөл эцэг', 'adoptive father'), t('өргөмөл эх', 'adoptive mother'), t('өргөмөл эцэг эх', 'adoptive parent')));
      }
      return k('parent', byGender(g, t('эцэг (аав)', 'father'), t('эх (ээж)', 'mother'), t('эцэг эх', 'parent')));
    }
    if (up === 2) {
      const side = maternal ? 'maternal' : 'paternal';
      const pre = maternal ? 'нагац ' : '';
      return k(`${side}-grandparent`, byGender(g,
        t(`${pre}өвөө`, `${side} grandfather`),
        t(`${pre}эмээ`, `${side} grandmother`),
        t(`${pre}өвөө эмээ`, `${side} grandparent`)));
    }
    if (up === 3) return k('great-grandparent', byGender(g, t('элэнц өвөө', 'great-grandfather'), t('элэнц эмээ', 'great-grandmother'), t('элэнц', 'great-grandparent')));
    if (up === 4) return k('great-great-grandparent', byGender(g, t('хуланц өвөө', 'great-great-grandfather'), t('хуланц эмээ', 'great-great-grandmother'), t('хуланц', 'great-great-grandparent')));
    return k(`ancestor-${up}`, byGender(g,
      t(`${up}-р үеийн өвөг`, `${up - 2}× great-grandfather`),
      t(`${up}-р үеийн эмэг`, `${up - 2}× great-grandmother`),
      t(`${up}-р үеийн өвөг дээдэс`, `${up - 2}× great-grandparent`)));
  }

  // Siblings
  if (up === 1 && down === 1) {
    const mine = new Set(idx.lineageParents(from));
    const shared = idx.lineageParents(to).filter((p) => mine.has(p));
    const half = shared.length === 1 && (mine.size > 1 || idx.lineageParents(to).length > 1);
    const older = isOlder(idx, to, from);
    let term: Term;
    if (older === true) term = byGender(g, t('ах', 'older brother'), t('эгч', 'older sister'), t('ах/эгч', 'older sibling'));
    else if (older === false) term = byGender(g, t('эрэгтэй дүү', 'younger brother'), t('эмэгтэй дүү', 'younger sister'), t('дүү', 'younger sibling'));
    else term = byGender(g, t('ах/дүү', 'brother'), t('эгч/дүү', 'sister'), t('ах эгч дүү', 'sibling'));
    if (half) {
      const viaMother = idx.get(shared[0])?.gender === 'female';
      return k(viaMother ? 'half-sibling-maternal' : 'half-sibling-paternal',
        t(`${viaMother ? 'эх нэгт' : 'эцэг нэгт'} ${term.mn}`, `half-${term.en.replace(/^(older|younger) /, '')} (${viaMother ? 'same mother' : 'same father'})`));
    }
    return k('sibling', term);
  }

  // Aunts & uncles
  if (up === 2 && down === 1) {
    const parent = stepToward(idx, from, rel.ancestor, up);
    const maternal = idx.get(parent ?? '')?.gender === 'female';
    const side = maternal ? 'нагац' : 'авга';
    return k(maternal ? 'maternal-aunt-uncle' : 'paternal-aunt-uncle', byGender(g,
      t(`${side} ах`, `uncle (${maternal ? "mother's" : "father's"} brother)`),
      t(`${side} эгч`, `aunt (${maternal ? "mother's" : "father's"} sister)`),
      t(side, `${maternal ? 'maternal' : 'paternal'} aunt/uncle`)));
  }
  if (up === 3 && down === 1) {
    const parent = stepToward(idx, from, rel.ancestor, up);
    const maternal = idx.get(parent ?? '')?.gender === 'female';
    return k('great-aunt-uncle', byGender(g,
      t(maternal ? 'нагац талын өвөө' : 'авга өвөө', 'great-uncle'),
      t(maternal ? 'нагац талын эмээ' : 'авга эмээ', 'great-aunt'),
      t(maternal ? 'нагац талын өвөг' : 'авга өвөг', 'great-aunt/uncle')));
  }

  // Nieces & nephews
  if (up === 1 && down === 2) {
    const sibling = childToward(idx, rel.ancestor, to, down);
    const viaSister = idx.get(sibling ?? '')?.gender === 'female';
    const en = byGender(g, t('', 'nephew'), t('', 'niece'), t('', 'nephew/niece')).en;
    return k(viaSister ? 'sister-child' : 'brother-child', t(viaSister ? 'зээ' : 'ач', `${en} (${viaSister ? "sister's" : "brother's"} child)`));
  }
  if (up === 1 && down === 3) {
    return k('grand-nephew-niece', t('ач зээгийн хүүхэд', byGender(g, t('', 'grandnephew'), t('', 'grandniece'), t('', 'grandnephew/niece')).en));
  }

  // Cousins
  if (up === down && up >= 2) {
    const n = up - 1;
    if (n === 1) {
      const myParent = stepToward(idx, from, rel.ancestor, up);
      const theirParent = stepToward(idx, to, rel.ancestor, down);
      const mineMale = idx.get(myParent ?? '')?.gender === 'male';
      const theirsMale = idx.get(theirParent ?? '')?.gender === 'male';
      const older = isOlder(idx, to, from);
      const age = older === true ? byGender(g, t(' ах', ''), t(' эгч', ''), t('', '')) : older === false ? t(' дүү', '') : t('', '');
      if (mineMale && theirsMale) return k('cousin-paternal', t(`үеэл${age.mn}`, 'first cousin (paternal line)'));
      if (!mineMale && !theirsMale) return k('cousin-maternal', t(`бүл${age.mn}`, 'first cousin (maternal line)'));
      return k('cousin-cross', t(`нага${age.mn}`, 'first cousin'));
    }
    if (n === 2) return k('second-cousin', t('хаяал', 'second cousin'));
    return k(`cousin-${n}`, t(`${n}-р эгнээний төрөл`, `${ordinalEn(n)} cousin`));
  }
  if (up >= 2 && down >= 2) {
    const n = Math.min(up, down) - 1;
    const removed = Math.abs(up - down);
    if (n === 1 && up > down) return k('parent-cousin', t('аав ээжийн үеэл', `first cousin ${removed}× removed`));
    if (n === 1 && down > up) return k('cousin-child', t('үеэлийн хүүхэд', `first cousin ${removed}× removed`));
    return k(`cousin-${n}-removed-${removed}`, t('төрөл садан', `${ordinalEn(n)} cousin ${removed}× removed`));
  }
  return k('blood-relative', t('төрөл садан', 'blood relative'));
}

function partnerTerm(idx: FamilyIndex, from: string, to: string): Kinship | null {
  const p = idx.partnershipBetween(from, to);
  if (!p) return null;
  const g = idx.get(to)?.gender;
  const ex = p.status === 'divorced';
  const term = byGender(g, t('нөхөр', 'husband'), t('эхнэр', 'wife'), t('хань', 'partner'));
  if (p.status === 'partner') return { key: 'partner', ...t('хань', 'partner'), category: 'partner' };
  return ex
    ? { key: 'ex-spouse', mn: `хуучин ${term.mn}`, en: `ex-${term.en}`, category: 'partner' }
    : { key: 'spouse', ...term, category: 'partner' };
}

/** `to` is the partner of one of `from`'s blood relatives. */
function spouseOfRelative(idx: FamilyIndex, from: string, to: string): Kinship | null {
  const g = idx.get(to)?.gender;
  let best: { rel: Blood; r: string } | null = null;
  for (const r of idx.partners(to)) {
    if (r === from) continue;
    const rel = bloodRelation(idx, from, r);
    if (rel && (!best || rel.up + rel.down < best.rel.up + best.rel.down)) best = { rel, r };
  }
  if (!best) return null;
  const { rel, r } = best;
  const rGender = idx.get(r)?.gender;
  const k = (key: string, term: Term, category: KinCategory = 'in-law'): Kinship => ({ key, ...term, category });

  if (rel.up === 0 && rel.down === 1) {
    return k('child-in-law', byGender(g, t('хүргэн', 'son-in-law'), t('бэр', 'daughter-in-law'), t('хүргэн/бэр', 'child-in-law')));
  }
  if (rel.up === 0 && rel.down === 2) {
    return k('grandchild-in-law', byGender(g, t('ач хүргэн', 'grandson-in-law'), t('ач бэр', 'granddaughter-in-law'), t('ач хүргэн/бэр', 'grandchild-in-law')));
  }
  if (rel.up === 1 && rel.down === 0) {
    return k('step-parent', byGender(g, t('хойд эцэг', 'stepfather'), t('хойд эх', 'stepmother'), t('хойд эцэг/эх', 'stepparent')), 'step');
  }
  if (rel.up === 1 && rel.down === 1) {
    const older = isOlder(idx, r, from);
    if (rGender === 'male') {
      return k(older === false ? 'younger-brother-wife' : 'older-brother-wife',
        t(older === false ? 'дүү бэр' : 'бэргэн', "sister-in-law (brother's wife)"));
    }
    return k(older === false ? 'younger-sister-husband' : 'older-sister-husband',
      t(older === false ? 'хүргэн дүү' : 'хүргэн ах', "brother-in-law (sister's husband)"));
  }
  if (rel.up === 2 && rel.down === 1) {
    const parent = stepToward(idx, from, rel.ancestor, rel.up);
    const maternal = idx.get(parent ?? '')?.gender === 'female';
    const side = maternal ? 'нагац' : 'авга';
    return k('aunt-uncle-in-law', rGender === 'male'
      ? t(`${side} бэргэн`, `aunt (wife of ${maternal ? "mother's" : "father's"} brother)`)
      : t(`${side} хүргэн ах`, `uncle (husband of ${maternal ? "mother's" : "father's"} sister)`));
  }
  return null;
}

/** `to` is a blood relative of one of `from`'s partners. */
function relativeOfSpouse(idx: FamilyIndex, from: string, to: string): Kinship | null {
  const g = idx.get(to)?.gender;
  for (const p of idx.partners(from)) {
    if (p === to) continue;
    const rel = bloodRelation(idx, p, to);
    if (!rel) continue;
    const k = (key: string, term: Term, category: KinCategory = 'in-law'): Kinship => ({ key, ...term, category });
    if (rel.up === 1 && rel.down === 0) {
      return k('parent-in-law', byGender(g, t('хадам эцэг', 'father-in-law'), t('хадам эх', 'mother-in-law'), t('хадам эцэг эх', 'parent-in-law')));
    }
    if (rel.up === 2 && rel.down === 0) {
      return k('grandparent-in-law', byGender(g, t('хадам өвөө', "spouse's grandfather"), t('хадам эмээ', "spouse's grandmother"), t('хадам өвөө эмээ', "spouse's grandparent")));
    }
    if (rel.up === 1 && rel.down === 1) {
      const older = isOlder(idx, to, p);
      const term = older === true
        ? byGender(g, t('хадам ах', 'brother-in-law'), t('хадам эгч', 'sister-in-law'), t('хадам ах/эгч', 'sibling-in-law'))
        : older === false
          ? byGender(g, t('хадам дүү', 'brother-in-law'), t('хадам дүү', 'sister-in-law'), t('хадам дүү', 'sibling-in-law'))
          : byGender(g, t('хадам ах/дүү', 'brother-in-law'), t('хадам эгч/дүү', 'sister-in-law'), t('хадам ах эгч дүү', 'sibling-in-law'));
      return k('sibling-in-law', term);
    }
    if (rel.up === 0 && rel.down === 1) {
      return k('stepchild', byGender(g, t('дагавар хүү', 'stepson'), t('дагавар охин', 'stepdaughter'), t('дагавар хүүхэд', 'stepchild')), 'step');
    }
    return k('spouse-relative', t('хадам талын төрөл', "spouse's relative"));
  }
  return null;
}

function coInLaws(idx: FamilyIndex, from: string, to: string): Kinship | null {
  const g = idx.get(to)?.gender;
  // худ / худгуй: parents of my child's spouse
  for (const c of idx.children(from)) {
    for (const q of idx.partners(c.id)) {
      if (idx.parents(q).some((p) => p.id === to)) {
        return { key: 'co-parent-in-law', ...byGender(g, t('худ', 'co-father-in-law'), t('худгуй', 'co-mother-in-law'), t('худ ураг', 'co-parent-in-law')), category: 'in-law' };
      }
    }
  }
  // баз: husbands of two sisters
  if (idx.get(from)?.gender === 'male' && g === 'male') {
    for (const wife of idx.partners(from)) {
      const sisters = idx.siblings(wife);
      for (const s of [...sisters.full, ...sisters.half]) {
        if (idx.get(s)?.gender === 'female' && idx.partners(s).includes(to)) {
          return { key: 'co-brother-in-law', ...t('баз', "co-brother-in-law (wife's sister's husband)"), category: 'in-law' };
        }
      }
    }
  }
  return null;
}

function directStep(idx: FamilyIndex, from: string, to: string): Kinship | null {
  const g = idx.get(to)?.gender;
  const asParent = idx.parents(from).find((p) => p.id === to);
  if (asParent?.type === 'step') return { key: 'step-parent', ...byGender(g, t('хойд эцэг', 'stepfather'), t('хойд эх', 'stepmother'), t('хойд эцэг/эх', 'stepparent')), category: 'step' };
  if (asParent?.type === 'foster') return { key: 'foster-parent', ...byGender(g, t('асран хүмүүжүүлэгч эцэг', 'foster father'), t('асран хүмүүжүүлэгч эх', 'foster mother'), t('асран хүмүүжүүлэгч', 'foster parent')), category: 'step' };
  const asChild = idx.children(from).find((c) => c.id === to);
  if (asChild?.type === 'step') return { key: 'stepchild', ...byGender(g, t('дагавар хүү', 'stepson'), t('дагавар охин', 'stepdaughter'), t('дагавар хүүхэд', 'stepchild')), category: 'step' };
  if (asChild?.type === 'foster') return { key: 'foster-child', ...t('асрамжийн хүүхэд', 'foster child'), category: 'step' };
  if (idx.siblings(from).step.includes(to)) {
    return { key: 'step-sibling', ...byGender(g, t('дагавар ах/дүү', 'stepbrother'), t('дагавар эгч/дүү', 'stepsister'), t('дагавар ах эгч дүү', 'stepsibling')), category: 'step' };
  }
  return null;
}

function isConnected(idx: FamilyIndex, from: string, to: string): boolean {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift() as string;
    if (cur === to) return true;
    const next = [...idx.parents(cur).map((p) => p.id), ...idx.children(cur).map((c) => c.id), ...idx.partners(cur)];
    for (const n of next) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

/** What does `from` call `to`? */
export function describeRelationship(idx: FamilyIndex, from: string, to: string): Kinship {
  if (from === to) return { key: 'self', mn: 'өөрөө', en: 'yourself', category: 'self' };
  const direct = directStep(idx, from, to);
  if (direct && direct.key !== 'step-sibling') return direct;
  const partner = partnerTerm(idx, from, to);
  if (partner) return partner;
  const blood = bloodRelation(idx, from, to);
  if (blood) {
    const term = bloodTerm(idx, from, to, blood);
    if (term) return term;
  }
  if (direct) return direct;
  const viaSpouse = spouseOfRelative(idx, from, to) ?? relativeOfSpouse(idx, from, to) ?? coInLaws(idx, from, to);
  if (viaSpouse) return viaSpouse;
  if (isConnected(idx, from, to)) return { key: 'relative', mn: 'төрөл садан', en: 'relative', category: 'relative' };
  return { key: 'none', mn: 'холбоо тогтоогоогүй', en: 'no known relation', category: 'none' };
}

/** Number of generations covered by the tree, counted along lineage links (for "nine generations"). */
export function generationDepth(idx: FamilyIndex): number {
  const gens = idx.generations();
  let max = -1;
  for (const g of gens.values()) max = Math.max(max, g);
  return max + 1;
}
