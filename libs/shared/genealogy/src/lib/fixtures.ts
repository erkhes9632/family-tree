import type { Gender, ParentLinkType, PartnershipDto, PartnershipStatus, PersonSummary, TreeGraph } from '@super-project/types';

/** Tiny builder for test trees. */
export function tree() {
  const g: TreeGraph = { persons: [], parentChild: [], partnerships: [] };
  const api = {
    person(id: string, gender: Gender, birthYear?: number, extra: Partial<PersonSummary> = {}) {
      g.persons.push({
        id,
        givenName: id,
        patronymic: null,
        clanName: null,
        gender,
        isLiving: true,
        birthDate: birthYear ? { year: birthYear, month: null, day: null, qualifier: 'exact' } : null,
        deathDate: null,
        photoUrl: null,
        userId: null,
        redacted: false,
        ...extra,
      });
      return api;
    },
    child(parent: string, child: string, type: ParentLinkType = 'biological') {
      g.parentChild.push({ id: `${parent}>${child}`, parentId: parent, childId: child, type });
      return api;
    },
    couple(a: string, b: string, status: PartnershipStatus = 'married', sortOrder = 0, extra: Partial<PartnershipDto> = {}) {
      g.partnerships.push({
        id: `${a}+${b}`,
        person1Id: a,
        person2Id: b,
        status,
        startDate: null,
        endDate: null,
        sortOrder,
        notes: null,
        ...extra,
      });
      return api;
    },
    graph: g,
  };
  return api;
}

/**
 * Three generations:
 *   gf + gm → dad, aunt ; mgf + mgm → mom, uncleM
 *   dad + mom → me (1990), bro (1985), sis (1995)
 *   dad + step (2nd wife) → halfBro (2005)
 *   aunt + auntHusband → cousin
 *   uncleM → cousinM
 *   me + wife → son → grandson ; wife's parents wifeDad + wifeMom ; wife's sister wifeSis + baz
 *   son + daughterInLaw ; daughterInLaw's father khud
 */
export function sampleFamily() {
  return tree()
    .person('gf', 'male', 1930).person('gm', 'female', 1933)
    .person('mgf', 'male', 1932).person('mgm', 'female', 1935)
    .person('dad', 'male', 1958).person('mom', 'female', 1960).person('step', 'female', 1970)
    .person('aunt', 'female', 1962).person('auntHusband', 'male', 1960)
    .person('uncleM', 'male', 1963)
    .person('me', 'male', 1990).person('bro', 'male', 1985).person('sis', 'female', 1995)
    .person('halfBro', 'male', 2005).person('stepKid', 'female', 1998)
    .person('cousin', 'female', 1988).person('cousinM', 'male', 1992)
    .person('wife', 'female', 1991).person('wifeDad', 'male', 1960).person('wifeMom', 'female', 1962)
    .person('wifeSis', 'female', 1994).person('baz', 'male', 1993)
    .person('son', 'male', 2015).person('daughterInLaw', 'female', 2016).person('khud', 'male', 1985)
    .person('grandson', 'male', 2040).person('broWife', 'female', 1987)
    .couple('gf', 'gm').couple('mgf', 'mgm')
    .child('gf', 'dad').child('gm', 'dad').child('gf', 'aunt').child('gm', 'aunt')
    .child('mgf', 'mom').child('mgm', 'mom').child('mgf', 'uncleM').child('mgm', 'uncleM')
    .couple('dad', 'mom', 'divorced', 0).couple('dad', 'step', 'married', 1)
    .child('dad', 'me').child('mom', 'me').child('dad', 'bro').child('mom', 'bro').child('dad', 'sis').child('mom', 'sis')
    .child('dad', 'halfBro').child('step', 'halfBro').child('step', 'stepKid')
    .couple('aunt', 'auntHusband').child('aunt', 'cousin').child('auntHusband', 'cousin')
    .child('uncleM', 'cousinM')
    .couple('me', 'wife').child('wifeDad', 'wife').child('wifeMom', 'wife').child('wifeDad', 'wifeSis').child('wifeMom', 'wifeSis')
    .couple('wifeSis', 'baz')
    .child('me', 'son').child('wife', 'son')
    .couple('son', 'daughterInLaw').child('khud', 'daughterInLaw')
    .child('son', 'grandson').child('daughterInLaw', 'grandson')
    .couple('bro', 'broWife');
}
