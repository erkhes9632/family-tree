/**
 * Generates SQL for development/demo data and the clan reference table.
 *
 *   bun apps/family-tree-service/scripts/seed.ts            → .seed/seed.sql (clans + demo data)
 *   bun apps/family-tree-service/scripts/seed.ts --clans    → .seed/clans.sql (clans only, safe for production)
 *
 * Applied with `wrangler d1 execute` (see the db:seed targets in project.json).
 * Demo rows use fixed `demo_` ids and are deleted first, so re-running is idempotent.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLANS } from '@super-project/genealogy';

type Val = string | number | boolean | null | undefined | object;

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
function lit(v: Val): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') return lit(JSON.stringify(v));
  return `'${v.replace(/'/g, "''")}'`;
}
function insert(table: string, row: Record<string, Val>, upsertKey?: string): string {
  const keys = Object.keys(row);
  const cols = keys.map(snake).join(', ');
  const vals = keys.map((k) => lit(row[k])).join(', ');
  const tail = upsertKey
    ? ` ON CONFLICT(${upsertKey}) DO UPDATE SET ${keys.filter((k) => snake(k) !== upsertKey).map((k) => `${snake(k)} = excluded.${snake(k)}`).join(', ')}`
    : '';
  return `INSERT INTO ${table} (${cols}) VALUES (${vals})${tail};`;
}

const NOW = Date.UTC(2026, 9, 1);
const sql: string[] = [];

// ── Clans (reference data) ──────────────────────────────────────────
for (const c of CLANS) {
  sql.push(insert('clans', { id: c.id, slug: c.slug, nameMn: c.nameMn, nameEn: c.nameEn, summaryMn: c.summaryMn, summaryEn: c.summaryEn, createdAt: NOW }, 'id'));
}

const clansOnly = process.argv.includes('--clans');

if (!clansOnly) {
  // ── Reset demo data ─────────────────────────────────────────────────
  sql.push(`DELETE FROM trees WHERE id IN ('demo_tree', 'demo_history');`);
  sql.push(`DELETE FROM users WHERE id LIKE 'user_demo_%';`);

  const users = [
    { id: 'user_demo_admin', displayName: 'Тэмүүлэн (demo admin)', email: 'admin@demo.local' },
    { id: 'user_demo_editor', displayName: 'Анужин (demo editor)', email: 'editor@demo.local' },
    { id: 'user_demo_viewer', displayName: 'Хулан (demo viewer)', email: 'viewer@demo.local' },
    { id: 'user_demo_outsider', displayName: 'Зочин (demo outsider)', email: 'outsider@demo.local' },
  ];
  for (const u of users) sql.push(insert('users', { ...u, locale: 'mn', timezone: 'Asia/Ulaanbaatar', createdAt: NOW, updatedAt: NOW }));

  // ── Demo family (≈40 people, 5 generations) ─────────────────────────
  const T = 'demo_tree';
  sql.push(
    insert('trees', {
      id: T,
      name: 'Боржигин Дамдины үр сад',
      description: 'Жишээ ургийн бичиг: 5 үе, дахин гэрлэлт, үрчлэлт, дагавар хүүхэдтэй. Demo family tree with five generations.',
      privacy: 'family',
      ownerId: 'user_demo_admin',
      rootPersonId: 'demo_temuulen',
      clanId: 'clan_borjigin',
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );

  type D = [number | null, number?, number?, ('exact' | 'about' | 'before' | 'after' | 'estimated')?];
  interface P {
    id: string;
    given: string;
    patronymic?: string;
    gender: 'male' | 'female';
    birth?: D;
    death?: D;
    clan?: string;
    extra?: Record<string, Val>;
  }
  const people: P[] = [
    // generation 1
    { id: 'damdin', given: 'Дамдин', patronymic: 'Жамъян', gender: 'male', birth: [1902, undefined, undefined, 'about'], death: [1972, 3, 14], clan: 'borjigin',
      extra: { occupation: 'Малчин', biography: 'Хэнтий аймгийн Биндэр суманд мал маллаж амьдарсан. Хоёр удаа гэрлэсэн.', birthPlace: { aimag: 'Хэнтий', sum: 'Биндэр', country: 'Монгол' }, burialPlace: { aimag: 'Хэнтий', sum: 'Биндэр', text: 'Онон голын хөвөө' } } },
    { id: 'khand', given: 'Ханд', gender: 'female', birth: [1905, undefined, undefined, 'about'], death: [1930, undefined, undefined, 'before'], extra: { memorial: 'Залуу насандаа таалал төгссөн.' } },
    { id: 'doljin', given: 'Должин', patronymic: 'Цэвэг', gender: 'female', birth: [1910, 6, 2], death: [1985, 1, 20] },
    // generation 2
    { id: 'tseren', given: 'Цэрэн', patronymic: 'Дамдин', gender: 'male', birth: [1926, 11, 5], death: [1995, 8, 9], clan: 'borjigin', extra: { occupation: 'Багш' } },
    { id: 'narangerel', given: 'Нарангэрэл', gender: 'female', birth: [1932], death: [2004] },
    { id: 'bat', given: 'Бат', patronymic: 'Дамдин', gender: 'male', birth: [1935, 4, 18], death: [2010, 10, 23], clan: 'borjigin',
      extra: { occupation: 'Инженер', education: [{ institution: 'Монгол Улсын Их Сургууль', field: 'Барилга', toYear: 1958 }], awards: [{ title: 'Хөдөлмөрийн гавьяаны улаан тугийн одон', year: 1981 }], messageToDescendants: 'Эрдэм сурч, эх орондоо хэрэгтэй хүн болоорой.' } },
    { id: 'oyun', given: 'Оюун', patronymic: 'Лхагва', gender: 'female', birth: [1937, 2, 11], death: [2015, 12, 2], extra: { occupation: 'Эмч' } },
    { id: 'suren', given: 'Сүрэн', patronymic: 'Дамдин', gender: 'female', birth: [1938], death: [2018, 5, 30], clan: 'borjigin' },
    { id: 'ganbaatar', given: 'Ганбаатар', patronymic: 'Нямаа', gender: 'male', birth: [1934], death: [1999] },
    { id: 'dorj', given: 'Дорж', patronymic: 'Дамдин', gender: 'male', birth: [1941, 9, 9], death: [2001, 2, 1], clan: 'borjigin', extra: { militaryService: 'Монголын Ардын Армид 1960–1963 онд алба хаасан.' } },
    { id: 'gerelmaa', given: 'Гэрэлмаа', gender: 'female', birth: [1945] },
    { id: 'tsetseg', given: 'Цэцэг', patronymic: 'Дамдин', gender: 'female', birth: [1946, 3, 8], clan: 'borjigin', extra: { occupation: 'Тэтгэвэрт', hobbies: 'Уран хатгамал, дуу' } },
    // generation 3
    { id: 'batjargal', given: 'Батжаргал', patronymic: 'Цэрэн', gender: 'male', birth: [1955], clan: 'borjigin' },
    { id: 'bold', given: 'Болд', patronymic: 'Бат', gender: 'male', birth: [1960, 7, 1], clan: 'borjigin', extra: { occupation: 'Жолооч', residence: { aimag: 'Улаанбаатар', text: 'Баянзүрх дүүрэг' } } },
    { id: 'sarantuya', given: 'Сарантуяа', gender: 'female', birth: [1963] },
    { id: 'oyunchimeg', given: 'Оюунчимэг', gender: 'female', birth: [1970, 1, 15] },
    { id: 'enkhtuya', given: 'Энхтуяа', patronymic: 'Бат', gender: 'female', birth: [1962, 12, 12], clan: 'borjigin' },
    { id: 'ganbold', given: 'Ганболд', gender: 'male', birth: [1958] },
    { id: 'ganzorig', given: 'Ганзориг', patronymic: 'Бат', gender: 'male', birth: [1965, 5, 5], death: [1990, 7, 11], clan: 'borjigin', extra: { memorial: 'Ахынхаа дурсгалд. Хөгжимд дуртай байсан.' } },
    { id: 'munkhbat', given: 'Мөнхбат', patronymic: 'Бат', gender: 'male', birth: [1968], clan: 'borjigin', extra: { biography: 'Бат, Оюун хоёрын өргөж авсан хүү.' } },
    { id: 'solongo', given: 'Солонго', gender: 'female', birth: [1970] },
    { id: 'altantsetseg', given: 'Алтанцэцэг', patronymic: 'Ганбаатар', gender: 'female', birth: [1963] },
    { id: 'batsukh', given: 'Батсүх', gender: 'male', birth: [1961] },
    { id: 'purev', given: 'Пүрэв', patronymic: 'Ганбаатар', gender: 'male', birth: [1966] },
    { id: 'ariunaa', given: 'Ариунаа', patronymic: 'Дорж', gender: 'female', birth: [1970], clan: 'borjigin' },
    // generation 4
    { id: 'temuulen', given: 'Тэмүүлэн', patronymic: 'Болд', gender: 'male', birth: [1988, 11, 2], clan: 'borjigin',
      extra: { occupation: 'Програм хангамжийн инженер', contacts: { phone: '+976 9911 0000', email: 'temuulen@example.mn' }, contactsVisibility: 'members' } },
    { id: 'mishel', given: 'Мишээл', gender: 'female', birth: [1990, 4, 4] },
    { id: 'anujin', given: 'Анужин', patronymic: 'Болд', gender: 'female', birth: [1991, 10, 24], clan: 'borjigin' },
    { id: 'erdene', given: 'Эрдэнэ', gender: 'male', birth: [1989] },
    { id: 'bilguun', given: 'Билгүүн', patronymic: 'Болд', gender: 'male', birth: [1999, 6, 1], clan: 'borjigin' },
    { id: 'nomin', given: 'Номин', patronymic: 'Ганзул', gender: 'female', birth: [1993, 9, 30] },
    { id: 'munkhzul', given: 'Мөнхзул', patronymic: 'Ганболд', gender: 'female', birth: [1985] },
    { id: 'ariunbold', given: 'Ариунболд', gender: 'male', birth: [1983] },
    { id: 'temujin', given: 'Тэмүжин', patronymic: 'Ганболд', gender: 'male', birth: [1987] },
    { id: 'khulan', given: 'Хулан', patronymic: 'Батсүх', gender: 'female', birth: [1990] },
    { id: 'tengis', given: 'Тэнгис', patronymic: 'Мөнхбат', gender: 'male', birth: [1995], clan: 'borjigin' },
    // generation 5
    { id: 'anand', given: 'Ананд', patronymic: 'Тэмүүлэн', gender: 'male', birth: [2015, 3, 3], clan: 'borjigin' },
    { id: 'esui', given: 'Есүй', patronymic: 'Тэмүүлэн', gender: 'female', birth: [2018, 10, 28], clan: 'borjigin' },
    { id: 'tuguldur', given: 'Төгөлдөр', patronymic: 'Эрдэнэ', gender: 'male', birth: [2016] },
    { id: 'sondor', given: 'Сондор', patronymic: 'Ариунболд', gender: 'male', birth: [2012] },
  ];

  const linked: Record<string, string> = { temuulen: 'user_demo_admin', anujin: 'user_demo_editor', khulan: 'user_demo_viewer' };

  for (const p of people) {
    const isLiving = !p.death;
    sql.push(
      insert('persons', {
        id: `demo_${p.id}`,
        treeId: T,
        givenName: p.given,
        patronymic: p.patronymic ?? null,
        clanName: p.clan ? 'Боржигин' : null,
        clanId: p.clan ? `clan_${p.clan}` : null,
        gender: p.gender,
        birthYear: p.birth?.[0] ?? null,
        birthMonth: p.birth?.[1] ?? null,
        birthDay: p.birth?.[2] ?? null,
        birthQualifier: p.birth ? (p.birth[3] ?? 'exact') : null,
        isLiving,
        deathYear: p.death?.[0] ?? null,
        deathMonth: p.death?.[1] ?? null,
        deathDay: p.death?.[2] ?? null,
        deathQualifier: p.death ? (p.death[3] ?? 'exact') : null,
        contactsVisibility: 'private',
        userId: linked[p.id] ?? null,
        createdBy: 'user_demo_admin',
        createdAt: NOW,
        updatedAt: NOW,
        ...(p.extra ?? {}),
      }),
    );
  }

  let n = 0;
  const child = (parent: string, kid: string, type = 'biological') =>
    sql.push(insert('parent_child', { id: `demo_pc${++n}`, treeId: T, parentId: `demo_${parent}`, childId: `demo_${kid}`, type, createdAt: NOW }));
  const couple = (a: string, b: string, status: string, order: number, start?: D, end?: D) =>
    sql.push(
      insert('partnerships', {
        id: `demo_pt_${a}_${b}`,
        treeId: T,
        person1Id: `demo_${a}`,
        person2Id: `demo_${b}`,
        status,
        sortOrder: order,
        startYear: start?.[0] ?? null,
        startMonth: start?.[1] ?? null,
        startDay: start?.[2] ?? null,
        startQualifier: start ? (start[3] ?? 'exact') : null,
        endYear: end?.[0] ?? null,
        endMonth: end?.[1] ?? null,
        endDay: end?.[2] ?? null,
        endQualifier: end ? (end[3] ?? 'exact') : null,
        createdAt: NOW,
      }),
    );

  // Дамдин: first wife Ханд (widowed), then Должин
  couple('damdin', 'khand', 'widowed', 0, [1924, undefined, undefined, 'about'], [1930, undefined, undefined, 'before']);
  couple('damdin', 'doljin', 'married', 1, [1933]);
  child('damdin', 'tseren'); child('khand', 'tseren');
  for (const k of ['bat', 'suren', 'dorj', 'tsetseg']) { child('damdin', k); child('doljin', k); }
  couple('tseren', 'narangerel', 'married', 0, [1953]);
  child('tseren', 'batjargal'); child('narangerel', 'batjargal');
  couple('bat', 'oyun', 'married', 0, [1959, 8, 15]);
  for (const k of ['bold', 'enkhtuya', 'ganzorig']) { child('bat', k); child('oyun', k); }
  child('bat', 'munkhbat', 'adoptive'); child('oyun', 'munkhbat', 'adoptive');
  couple('suren', 'ganbaatar', 'married', 0, [1961]);
  for (const k of ['altantsetseg', 'purev']) { child('suren', k); child('ganbaatar', k); }
  couple('dorj', 'gerelmaa', 'married', 0, [1968]);
  child('dorj', 'ariunaa'); child('gerelmaa', 'ariunaa');
  // Болд: divorced from Сарантуяа, remarried Оюунчимэг (who brought her daughter Номин)
  couple('bold', 'sarantuya', 'divorced', 0, [1987], [1995]);
  couple('bold', 'oyunchimeg', 'married', 1, [1997, 10, 26]);
  for (const k of ['temuulen', 'anujin']) { child('bold', k); child('sarantuya', k); }
  child('bold', 'bilguun'); child('oyunchimeg', 'bilguun');
  child('oyunchimeg', 'nomin'); child('bold', 'nomin', 'step');
  couple('enkhtuya', 'ganbold', 'married', 0, [1984]);
  for (const k of ['munkhzul', 'temujin']) { child('enkhtuya', k); child('ganbold', k); }
  couple('munkhbat', 'solongo', 'married', 0, [1994]);
  child('munkhbat', 'tengis'); child('solongo', 'tengis');
  couple('altantsetseg', 'batsukh', 'married', 0, [1989]);
  child('altantsetseg', 'khulan'); child('batsukh', 'khulan');
  couple('temuulen', 'mishel', 'married', 0, [2014, 10, 25]);
  child('temuulen', 'anand'); child('mishel', 'anand'); child('temuulen', 'esui'); child('mishel', 'esui');
  couple('anujin', 'erdene', 'married', 0, [2015]);
  child('anujin', 'tuguldur'); child('erdene', 'tuguldur');
  couple('munkhzul', 'ariunbold', 'partner', 0);
  child('munkhzul', 'sondor'); child('ariunbold', 'sondor');

  // Members (linked accounts); everyone else is an unregistered person
  sql.push(insert('tree_members', { treeId: T, userId: 'user_demo_admin', role: 'admin', personId: 'demo_temuulen', joinedAt: NOW }));
  sql.push(insert('tree_members', { treeId: T, userId: 'user_demo_editor', role: 'editor', personId: 'demo_anujin', joinedAt: NOW }));
  sql.push(insert('tree_members', { treeId: T, userId: 'user_demo_viewer', role: 'viewer', personId: 'demo_khulan', joinedAt: NOW }));

  // Events
  const ev = (id: string, person: string | null, type: string, title: string, year: number, extra: Record<string, Val> = {}) =>
    sql.push(insert('events', { id: `demo_ev_${id}`, treeId: T, personId: person ? `demo_${person}` : null, type, title, dateYear: year, dateQualifier: 'exact', createdBy: 'user_demo_admin', createdAt: NOW, updatedAt: NOW, ...extra }));
  ev('bat_grad', 'bat', 'graduation', 'МУИС төгссөн', 1958);
  ev('dorj_army', 'dorj', 'military', 'Цэргийн алба', 1960, { description: '1960–1963' });
  ev('bat_award', 'bat', 'award', 'Хөдөлмөрийн гавьяаны улаан тугийн одон', 1981);
  ev('move_ub', 'bold', 'migration', 'Хэнтийгээс Улаанбаатар руу нүүсэн', 1992, { place: { aimag: 'Улаанбаатар' } });
  ev('tsetseg_award', 'tsetseg', 'award', 'Алдарт эх одон', 1986);
  ev('reunion', null, 'custom', 'Ургийн их цуглаан', 2019, { description: 'Дамдины үр сад 120 гаруй хүн цугларсан.', dateMonth: 7, dateDay: 13 });

  sql.push(insert('person_custom_fields', { id: 'demo_cf1', treeId: T, personId: 'demo_damdin', key: 'Дуртай морь', value: 'Хээр морь', sortOrder: 0 }));
  sql.push(insert('person_custom_fields', { id: 'demo_cf2', treeId: T, personId: 'demo_damdin', key: 'Нутаг ус', value: 'Онон гол', sortOrder: 1 }));
  sql.push(insert('albums', { id: 'demo_album_old', treeId: T, title: 'Хуучин зургууд', description: 'Сканнердсан хар цагаан зургууд', createdBy: 'user_demo_admin', createdAt: NOW }));
  sql.push(insert('stories', { id: 'demo_story_1', treeId: T, personId: 'demo_damdin', title: 'Өвөөгийн нүүдлийн тухай', body: 'Дамдин өвөө намар бүр Онон голын хөвөөнөөс өвөлжөө рүүгээ нүүдэг байсан гэж ээж минь ярьдаг...', dateYear: 1950, dateQualifier: 'about', createdBy: 'user_demo_admin', createdAt: NOW, updatedAt: NOW }));

  // ── Public historical tree ──────────────────────────────────────────
  const H = 'demo_history';
  sql.push(insert('trees', { id: H, name: 'Чингис хааны ураг (жишээ)', description: 'Нийтэд нээлттэй түүхэн угийн бичгийн жишээ. Based on the Secret History of the Mongols.', privacy: 'public', ownerId: 'user_demo_admin', rootPersonId: 'demo_h_temujin', clanId: 'clan_borjigin', createdAt: NOW, updatedAt: NOW }));
  sql.push(insert('tree_members', { treeId: H, userId: 'user_demo_admin', role: 'admin', joinedAt: NOW }));
  const hp: [string, string, 'male' | 'female', number | null, number | null, string?][] = [
    ['yesugei', 'Есүхэй баатар', 'male', null, 1171],
    ['hoelun', 'Өэлүн', 'female', null, null],
    ['temujin', 'Тэмүжин (Чингис хаан)', 'male', 1162, 1227],
    ['borte', 'Бөртэ үжин', 'female', 1161, null],
    ['khasar', 'Хасар', 'male', null, null],
    ['temuge', 'Тэмүгэ отчигин', 'male', null, null],
    ['temulun', 'Тэмүлүн', 'female', null, null],
    ['jochi', 'Зүчи', 'male', null, 1227],
    ['tsagaadai', 'Цагаадай', 'male', null, 1242],
    ['ugudei', 'Өгөдэй хаан', 'male', 1186, 1241],
    ['tolui', 'Тулуй', 'male', null, 1232],
    ['sorkhagtani', 'Сорхагтани бэхи', 'female', null, 1252],
    ['munkh', 'Мөнх хаан', 'male', 1209, 1259],
    ['khubilai', 'Хубилай хаан', 'male', 1215, 1294],
    ['batu', 'Бат хаан', 'male', null, 1255],
  ];
  for (const [id, name, gender, b, d] of hp) {
    sql.push(insert('persons', {
      id: `demo_h_${id}`, treeId: H, givenName: name, clanName: gender === 'male' ? 'Боржигин' : null, clanId: gender === 'male' ? 'clan_borjigin' : null,
      gender, birthYear: b, birthQualifier: b ? 'about' : null, isLiving: false, deathYear: d, deathQualifier: d ? 'exact' : null,
      contactsVisibility: 'private', createdBy: 'user_demo_admin', createdAt: NOW, updatedAt: NOW,
    }));
  }
  let h = 0;
  const hc = (p: string, c: string) => sql.push(insert('parent_child', { id: `demo_hpc${++h}`, treeId: H, parentId: `demo_h_${p}`, childId: `demo_h_${c}`, type: 'biological', createdAt: NOW }));
  const hm = (a: string, b: string) => sql.push(insert('partnerships', { id: `demo_hpt_${a}`, treeId: H, person1Id: `demo_h_${a}`, person2Id: `demo_h_${b}`, status: 'married', sortOrder: 0, createdAt: NOW }));
  hm('yesugei', 'hoelun');
  for (const k of ['temujin', 'khasar', 'temuge', 'temulun']) { hc('yesugei', k); hc('hoelun', k); }
  hm('temujin', 'borte');
  for (const k of ['jochi', 'tsagaadai', 'ugudei', 'tolui']) { hc('temujin', k); hc('borte', k); }
  hm('tolui', 'sorkhagtani');
  for (const k of ['munkh', 'khubilai']) { hc('tolui', k); hc('sorkhagtani', k); }
  hc('jochi', 'batu');
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '.seed', clansOnly ? 'clans.sql' : 'seed.sql');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql.join('\n') + '\n');
console.log(`Wrote ${sql.length} statements to ${out}`);
