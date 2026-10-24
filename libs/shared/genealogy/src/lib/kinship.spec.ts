import { sampleFamily, tree } from './fixtures';
import { FamilyIndex } from './graph';
import { describeRelationship, generationDepth } from './kinship';

const idx = new FamilyIndex(sampleFamily().graph);
const rel = (from: string, to: string) => describeRelationship(idx, from, to);

describe('siblings', () => {
  it('derives full, half and step siblings from parent links', () => {
    const s = idx.siblings('me');
    expect(s.full).toEqual(['bro', 'sis']);
    expect(s.half).toEqual(['halfBro']);
    expect(s.step).toEqual(['stepKid']);
  });
});

describe('describeRelationship (from "me")', () => {
  it.each([
    ['me', 'өөрөө', 'yourself'],
    ['dad', 'эцэг (аав)', 'father'],
    ['mom', 'эх (ээж)', 'mother'],
    ['gf', 'өвөө', 'paternal grandfather'],
    ['mgm', 'нагац эмээ', 'maternal grandmother'],
    ['bro', 'ах', 'older brother'],
    ['sis', 'эмэгтэй дүү', 'younger sister'],
    ['aunt', 'авга эгч', "aunt (father's sister)"],
    ['uncleM', 'нагац ах', "uncle (mother's brother)"],
    ['cousin', 'нага эгч', 'first cousin'],
    ['wife', 'эхнэр', 'wife'],
    ['son', 'хүү', 'son'],
    ['grandson', 'ач', 'grandson'],
    ['wifeDad', 'хадам эцэг', 'father-in-law'],
    ['wifeSis', 'хадам дүү', 'sister-in-law'],
    ['daughterInLaw', 'бэр', 'daughter-in-law'],
    ['broWife', 'бэргэн', "sister-in-law (brother's wife)"],
    ['step', 'хойд эх', 'stepmother'],
    ['stepKid', 'дагавар эгч/дүү', 'stepsister'],
    ['baz', 'баз', "co-brother-in-law (wife's sister's husband)"],
    ['khud', 'худ', 'co-father-in-law'],
  ])('me → %s', (to, mn, en) => {
    const r = rel('me', to);
    expect({ mn: r.mn, en: r.en }).toEqual({ mn, en });
  });

  it('marks half-siblings by the shared parent', () => {
    expect(rel('me', 'halfBro')).toMatchObject({ key: 'half-sibling-paternal', mn: 'эцэг нэгт эрэгтэй дүү' });
  });

  it('reports divorced partners as ex-spouses', () => {
    expect(rel('dad', 'mom')).toMatchObject({ key: 'ex-spouse', en: 'ex-wife' });
  });

  it('uses зээ for a daughter-line grandchild and nephews via sisters', () => {
    const t = tree()
      .person('a', 'female', 1950).person('d', 'female', 1975).person('s', 'male', 1977)
      .person('g', 'female', 2000).person('n', 'male', 2002)
      .child('a', 'd').child('a', 's').child('d', 'g').child('s', 'n');
    const i = new FamilyIndex(t.graph);
    expect(describeRelationship(i, 'a', 'g').mn).toBe('зээ');
    expect(describeRelationship(i, 'a', 'n').mn).toBe('ач');
    expect(describeRelationship(i, 's', 'g')).toMatchObject({ mn: 'зээ', en: "niece (sister's child)" });
    expect(describeRelationship(i, 'd', 'n')).toMatchObject({ mn: 'ач', en: "nephew (brother's child)" });
  });

  it('handles adoption and unknown people', () => {
    const t = tree().person('p', 'male').person('c', 'female').person('x', 'male').child('p', 'c', 'adoptive');
    const i = new FamilyIndex(t.graph);
    expect(describeRelationship(i, 'p', 'c').en).toBe('adopted daughter');
    expect(describeRelationship(i, 'c', 'p').en).toBe('adoptive father');
    expect(describeRelationship(i, 'p', 'x').key).toBe('none');
  });

  it('names deep ancestors', () => {
    const t = tree();
    const ids = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5'];
    ids.forEach((id) => t.person(id, 'male'));
    for (let i = 0; i < ids.length - 1; i++) t.child(ids[i], ids[i + 1]);
    const i = new FamilyIndex(t.graph);
    expect(describeRelationship(i, 'g5', 'g2').mn).toBe('элэнц өвөө');
    expect(describeRelationship(i, 'g5', 'g1').mn).toBe('хуланц өвөө');
    expect(describeRelationship(i, 'g5', 'g0').en).toBe('3× great-grandfather');
    expect(describeRelationship(i, 'g0', 'g3').mn).toBe('гуч');
    expect(generationDepth(i)).toBe(6);
  });

  it('detects cycles before linking', () => {
    expect(idx.wouldCreateCycle('son', 'gf')).toBe(true);
    expect(idx.wouldCreateCycle('gf', 'son')).toBe(false);
    expect(idx.wouldCreateCycle('me', 'me')).toBe(true);
  });
});
