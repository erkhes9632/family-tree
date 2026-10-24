/**
 * Seed dataset of Mongolian clans (овог / яс). Single source of truth: the web app
 * renders static clan pages from it and the service seeds the `clans` table with it,
 * so persons can link to a clan by id.
 *
 * The texts are short overviews drawn from widely cited history (the Secret History
 * of the Mongols, Rashid al-Din's Jami' al-tawarikh). Families are encouraged to add
 * their own sources; spellings vary (e.g. Боржигин / Боржигон).
 */
export interface ClanSeed {
  id: string;
  slug: string;
  nameMn: string;
  nameEn: string;
  altNames: string[];
  summaryMn: string;
  summaryEn: string;
  historyMn: string;
  historyEn: string;
  notableMn: string[];
  notableEn: string[];
}

export const CLANS: ClanSeed[] = [
  {
    id: 'clan_borjigin',
    slug: 'borjigin',
    nameMn: 'Боржигин',
    nameEn: 'Borjigin',
    altNames: ['Боржигон', 'Borjigon'],
    summaryMn: 'Чингис хааны төрсөн овог. Өнөөдөр Монголд хамгийн олон хүний сонгосон ургийн овог.',
    summaryEn: "The clan of Chinggis Khaan, and today the clan name chosen by the largest number of people in Mongolia.",
    historyMn:
      'Монголын нууц товчоонд Боржигин овгийн уг гарвалыг Бодончар мунхагаас эхлүүлдэг. Есүхэй баатар, түүний хүү Тэмүжин (Чингис хаан) энэ овгоос гаралтай. Их Монгол Улсын үеэс хойш хаадын угсаа (Алтан ураг) Боржигин овгоос тасралтгүй залгамжилсан. ХХ зуунд ургийн овгоо хэрэглэх нь тасарч, 1990-ээд оноос иргэд овгоо сэргээн бүртгүүлэх үед олон хүн өөрийн угаа тодорхойлж чадалгүй Боржигин овгийг сонгосон гэдэг.',
    historyEn:
      "The Secret History of the Mongols traces the Borjigin line to Bodonchar the Simple. Yesügei Baatar and his son Temüjin (Chinggis Khaan) belonged to it, and the ruling 'Golden Lineage' (Altan Urag) of the Mongol Empire and later khanates descended from it. When clan names were re-registered from the late 1990s, after decades of disuse, many Mongolians who could not trace their own clan chose Borjigin.",
    notableMn: ['Есүхэй баатар', 'Чингис хаан', 'Хубилай хаан', 'Даян хаан'],
    notableEn: ['Yesügei Baatar', 'Chinggis Khaan', 'Khubilai Khaan', 'Dayan Khaan'],
  },
  {
    id: 'clan_khiyad',
    slug: 'khiyad',
    nameMn: 'Хиад',
    nameEn: 'Khiyad',
    altNames: ['Kiyat', 'Хиад Боржигин'],
    summaryMn: 'Боржигинтой нэг угсааны эртний овог; Хабул хааны үр удмыг ихэвчлэн Хиад гэж нэрлэдэг.',
    summaryEn: 'An ancient clan closely tied to the Borjigin; descendants of Khabul Khan are often called Khiyad.',
    historyMn:
      'Рашид-ад-Дины «Судрын чуулган»-д Хиад овгийг Хабул хааны үр удамтай холбож өгүүлдэг. Чингис хааны өвөг дээдэс «Хиад Боржигин» хэмээн нэрлэгдэх нь бий.',
    historyEn:
      "Rashid al-Din's Compendium of Chronicles links the Khiyad to the descendants of Khabul Khan, and Chinggis Khaan's line is sometimes styled 'Khiyad-Borjigin'.",
    notableMn: ['Хабул хаан', 'Хутула хаан'],
    notableEn: ['Khabul Khan', 'Khutula Khan'],
  },
  {
    id: 'clan_besud',
    slug: 'besud',
    nameMn: 'Бэсүд',
    nameEn: 'Besud',
    altNames: ['Besüt'],
    summaryMn: 'Нирун монголын эртний овог; Чингис хааны алдарт жанжин Зэвийн овог гэж уламжилдаг.',
    summaryEn: 'An old Niru\'un Mongol clan, traditionally named as the clan of the famous general Jebe.',
    historyMn:
      'Бэсүд овгийг Бодончарын угсаанаас салбарласан Нирун монголчуудын нэг гэж үздэг. Зэв жанжин анх Тайчуудын харьяат байгаад хожим Тэмүжинд дагаар орсон гэж Нууц товчоонд өгүүлдэг. Өнөөдөр Монголын олон аймагт Бэсүд овогтой айл бий.',
    historyEn:
      "The Besud are counted among the Niru'un Mongols descended from Bodonchar's line. The Secret History tells how Jebe, first a follower of the Taichiud, joined Temüjin. Families with the Besud clan name live across many aimags today.",
    notableMn: ['Зэв жанжин'],
    notableEn: ['General Jebe'],
  },
  {
    id: 'clan_taichiud',
    slug: 'taichiud',
    nameMn: 'Тайчууд',
    nameEn: 'Taichiud',
    altNames: ["Tayichi'ud"],
    summaryMn: 'Хайду хааны үр удмаас гаралтай хүчирхэг овог; Тэмүжиний залуу насны өрсөлдөгч.',
    summaryEn: "A powerful clan descended from Khaidu Khan, and the young Temüjin's main rival.",
    historyMn:
      'Есүхэйг нас барсны дараа Тайчуудын ноёд Өэлүн эх, хүүхдүүдийг нь орхин нүүсэн бөгөөд хожим Тэмүжинийг олзолж байсныг Нууц товчоонд өгүүлдэг. Тэмүжин Тайчуудыг 1200 оны орчим дарсан.',
    historyEn:
      "After Yesügei's death, the Taichiud leaders abandoned Hö'elün and her children and later held Temüjin captive, as told in the Secret History. Temüjin defeated them around 1200.",
    notableMn: ['Таргудай Хирилтуг'],
    notableEn: ['Targutai Kiriltuk'],
  },
  {
    id: 'clan_jalair',
    slug: 'jalair',
    nameMn: 'Жалайр',
    nameEn: 'Jalair',
    altNames: ['Jalayir'],
    summaryMn: 'Эртний томоохон овог; Чингис хааны дөрвөн хүлэгийн нэг Мухулай жанжны овог.',
    summaryEn: 'A large ancient clan; the clan of Mukhali, one of the four great generals of Chinggis Khaan.',
    historyMn:
      'Жалайрчууд Чингис хааны төрд олон алдартай жанжин, түшмэлийг төрүүлсэн. Мухулай жанжин хааны зарлигаар Хятадын хойд нутгийн дайныг удирдаж байв.',
    historyEn:
      'The Jalair gave the Mongol state many commanders and officials. Mukhali led the campaigns in northern China on the Khaan\'s behalf.',
    notableMn: ['Мухулай жанжин'],
    notableEn: ['General Mukhali'],
  },
  {
    id: 'clan_khongirad',
    slug: 'khongirad',
    nameMn: 'Хонгирад',
    nameEn: 'Khongirad',
    altNames: ['Onggirat', 'Унгират'],
    summaryMn: 'Бөртэ үжин хатны овог; хаадын угсаатай ураг барилддаг уламжлалтай овог.',
    summaryEn: "The clan of Börte, Chinggis Khaan's chief wife, traditionally intermarrying with the ruling line.",
    historyMn:
      'Есүхэй баатар хүү Тэмүжиндээ Хонгирадын Дэй сэцэний охин Бөртэг гуйж очсон тухай Нууц товчоонд өгүүлдэг. Хонгирадын олон бүсгүй хожмын хаадын хатан болсон.',
    historyEn:
      'The Secret History tells how Yesügei went to Dei Sechen of the Khongirad to ask for his daughter Börte as a bride for Temüjin. Many later empresses came from this clan.',
    notableMn: ['Бөртэ үжин', 'Дэй сэцэн', 'Чаби хатан'],
    notableEn: ['Börte Üjin', 'Dei Sechen', 'Empress Chabi'],
  },
  {
    id: 'clan_olkhonuud',
    slug: 'olkhonuud',
    nameMn: 'Олхонуд',
    nameEn: 'Olkhonuud',
    altNames: ["Olkhunu'ud"],
    summaryMn: 'Чингис хааны эх Өэлүний овог; Хонгирадын салбар гэж үздэг.',
    summaryEn: "The clan of Hö'elün, Chinggis Khaan's mother; usually considered a branch of the Khongirad.",
    historyMn:
      'Өэлүн эх Олхонуд овгийн бүсгүй байсан бөгөөд Есүхэй баатар түүнийг Мэргидийн Их Чилэдүүгээс булаан авсан тухай Нууц товчоонд өгүүлдэг.',
    historyEn:
      "Hö'elün was an Olkhonuud woman whom Yesügei Baatar took from Chiledu of the Merkit, according to the Secret History.",
    notableMn: ['Өэлүн эх'],
    notableEn: ["Hö'elün"],
  },
  {
    id: 'clan_uriankhai',
    slug: 'uriankhai',
    nameMn: 'Урианхай',
    nameEn: 'Uriankhai',
    altNames: ['Uriangkhai'],
    summaryMn: 'Ойн иргэдтэй холбоотой эртний овог; Зэлмэ, Сүбээдэй баатрын овог.',
    summaryEn: 'An ancient clan associated with the forest peoples; the clan of Jelme and Sübe\'etei.',
    historyMn:
      'Зэлмэ болон түүний дүү Сүбээдэй баатар Урианхай овгоос гаралтай. Сүбээдэй Европ хүртэлх аян дайныг удирдсан алдарт жанжин юм. «Урианхай» гэдэг нэр өөр өөр үед өөр бүлэг ард түмнийг заасан тул анхааралтай хэрэглэх хэрэгтэй.',
    historyEn:
      "Jelme and his younger brother Sübe'etei were Uriankhai; Sübe'etei led campaigns as far as Europe. The name 'Uriankhai' has referred to different groups in different periods, so care is needed.",
    notableMn: ['Зэлмэ', 'Сүбээдэй баатар'],
    notableEn: ['Jelme', "Sübe'etei"],
  },
  {
    id: 'clan_barulas',
    slug: 'barulas',
    nameMn: 'Барулас',
    nameEn: 'Barulas',
    altNames: ['Barlas'],
    summaryMn: 'Боржигинтой нэг угсааны овог; Төв Азид Барлас нэрээр алдаршсан.',
    summaryEn: 'A clan related to the Borjigin, later famous in Central Asia as the Barlas.',
    historyMn:
      'Барулас овгийн Хорчи Тэмүжинийг хаан болохыг зөгнөсөн тухай Нууц товчоонд гардаг. Хожим Төв Азид суурьшсан Барлас овгоос Төмөр (Тамерлан) гаралтай.',
    historyEn:
      'The Secret History mentions Khorchi of the Barulas foretelling Temüjin\'s rise. A branch that settled in Central Asia as the Barlas produced Timur (Tamerlane).',
    notableMn: ['Хорчи', 'Төмөр (Тамерлан)'],
    notableEn: ['Khorchi', 'Timur (Tamerlane)'],
  },
  {
    id: 'clan_merkit',
    slug: 'merkit',
    nameMn: 'Мэргид',
    nameEn: 'Merkit',
    altNames: ['Mergid'],
    summaryMn: 'Сэлэнгийн сав нутгаар нутагласан хүчирхэг аймаг; хожим Монголын төрд нэгдсэн.',
    summaryEn: 'A powerful people of the Selenge basin, later absorbed into the Mongol state.',
    historyMn:
      'Мэргидүүд Бөртэ үжинг булаан авч, Тэмүжин Тоорил хан, Жамухын хамт тэднийг буцааж авсан тухай Нууц товчоонд өгүүлдэг. Өнөөдөр Мэргид овогтой айлууд бий.',
    historyEn:
      'The Merkit abducted Börte, and Temüjin rescued her with Toghrul Khan and Jamukha, as told in the Secret History. Families still carry the Merkit name today.',
    notableMn: ['Тогтоа бэх'],
    notableEn: ["Toqto'a Beki"],
  },
  {
    id: 'clan_bayad',
    slug: 'bayad',
    nameMn: 'Баяд',
    nameEn: 'Bayad',
    altNames: ['Bayaut'],
    summaryMn: 'Эртний монгол овог; өнөөдөр баруун Монголд Баяд ястан нэрээр алдартай.',
    summaryEn: 'An ancient Mongol clan; today the name also denotes the Bayad ethnic group of western Mongolia.',
    historyMn:
      'Баяд нь Их Монгол Улсын үеэс тэмдэглэгдсэн овог бөгөөд хожим Ойрадын бүрэлдэхүүнд орсон. Өнөөдөр Увс аймагт Баяд ястны олон хүн амьдардаг.',
    historyEn:
      'The Bayad appear in records from the Mongol Empire and later became part of the Oirat confederation. Many Bayad people live in Uvs aimag today.',
    notableMn: [],
    notableEn: [],
  },
  {
    id: 'clan_tsookhor',
    slug: 'tsookhor',
    nameMn: 'Цоохор',
    nameEn: 'Tsookhor',
    altNames: [],
    summaryMn: 'Өнөөгийн Монголд түгээмэл ургийн овгуудын нэг.',
    summaryEn: 'One of the common clan names in present-day Mongolia.',
    historyMn:
      'Цоохор овог Халхын олон хошуунд тархсан. Гарал үүслийн талаар янз бүрийн уламжлал байдаг тул гэр бүлийн түүхээ ахмадуудаас тодруулахыг зөвлөж байна.',
    historyEn:
      'The Tsookhor name is found across many Khalkha banners. Traditions about its origin differ, so families are encouraged to record what their elders remember.',
    notableMn: [],
    notableEn: [],
  },
  {
    id: 'clan_khalkha_sartuul',
    slug: 'sartuul',
    nameMn: 'Сартуул',
    nameEn: 'Sartuul',
    altNames: ['Sartul'],
    summaryMn: 'Төв Азиас ирсэн гаралтай гэж уламжилдаг, баруун хойд Монголд түгээмэл овог.',
    summaryEn: 'A clan traditionally said to have Central Asian origins, common in north-western Mongolia.',
    historyMn:
      '«Сартуул» гэдэг нэр Монголын эзэнт гүрний үед Төв Азийн суурин иргэдийг нэрлэж байсан «сартаул» гэдэг үгтэй холбоотой гэж үздэг. Завхан аймагт Сартуул овогтой айл олон.',
    historyEn:
      "The name is usually linked to 'sarta'ul', the Mongol Empire-era term for settled Central Asian peoples. Many Sartuul families live in Zavkhan aimag.",
    notableMn: [],
    notableEn: [],
  },
  {
    id: 'clan_tumed',
    slug: 'tumed',
    nameMn: 'Түмэд',
    nameEn: 'Tümed',
    altNames: ['Tumed'],
    summaryMn: 'Түмэн буюу цэрэг-засаг захиргааны томоохон нэгжээс үүдэлтэй овог, аймаг.',
    summaryEn: 'A clan and tribe whose name derives from the tümen, the large military-administrative unit.',
    historyMn:
      'XVI зуунд Түмэдийн Алтан хаан Өвөр Монголд хүчирхэгжиж, 1578 онд Төвдийн III Далай ламтай уулзсан нь Монголд бурхны шашин дахин дэлгэрэхэд нөлөөлсөн.',
    historyEn:
      "In the 16th century Altan Khan of the Tümed rose to power in what is now Inner Mongolia; his 1578 meeting with the 3rd Dalai Lama helped Buddhism spread again among the Mongols.",
    notableMn: ['Алтан хаан'],
    notableEn: ['Altan Khan'],
  },
];

export const CLANS_BY_SLUG: ReadonlyMap<string, ClanSeed> = new Map(CLANS.map((c) => [c.slug, c]));
