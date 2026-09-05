export type LocationGroupId =
  | 'ug-housing'
  | 'pg-housing'
  | 'staff-housing'
  | 'academic-core'
  | 'lsk-campus'
  | 'campus-life';

export type CampusLocale = 'en' | 'zh-CN' | 'zh-HK';

export type CampusLocation = {
  id: string;
  label: string;
  shortLabel: string;
  group: LocationGroupId;
  x: number;
  y: number;
  size: number;
};

export const locationGroups: Array<{
  id: LocationGroupId;
  label: string;
  labelZhHk: string;
  labelEn: string;
  description: string;
  descriptionZhHk: string;
  descriptionEn: string;
}> = [
  {
    id: 'ug-housing',
    label: '本科生宿舍',
    labelZhHk: '本科生宿舍',
    labelEn: 'UG Halls',
    description: 'Hall I–XIII 与赛马会大楼',
    descriptionZhHk: 'Hall I–XIII 與賽馬會大樓',
    descriptionEn: 'Halls I–XIII and Jockey Club residences',
  },
  {
    id: 'pg-housing',
    label: '研究生宿舍',
    labelZhHk: '研究生宿舍',
    labelEn: 'PG Housing',
    description: 'PG Hall、University Apartments 与 GGT',
    descriptionZhHk: 'PG Hall、University Apartments 與 GGT',
    descriptionEn: 'PG Halls, University Apartments and GGT',
  },
  {
    id: 'staff-housing',
    label: '教职员宿舍',
    labelZhHk: '教職員宿舍',
    labelEn: 'Staff Quarters',
    description: '按官方校园图分组展示 Staff Quarters',
    descriptionZhHk: '按官方校園圖分組展示 Staff Quarters',
    descriptionEn: 'Staff Quarters grouped by the official campus map',
  },
  {
    id: 'academic-core',
    label: '教学区',
    labelZhHk: '教學區',
    labelEn: 'Academic Core',
    description: '学术大楼、图书馆与主要教学设施',
    descriptionZhHk: '學術大樓、圖書館與主要教學設施',
    descriptionEn: 'Academic Building, Library and teaching facilities',
  },
  {
    id: 'lsk-campus',
    label: '李兆基校区',
    labelZhHk: '李兆基校區',
    labelEn: 'LSK Campus',
    description: '商学院、IAS 与南门一带',
    descriptionZhHk: '商學院、IAS 與南門一帶',
    descriptionEn: 'Business School, IAS and the South Entrance area',
  },
  {
    id: 'campus-life',
    label: '校园生活',
    labelZhHk: '校園生活',
    labelEn: 'Campus Life',
    description: '交通、运动、演艺与公共空间',
    descriptionZhHk: '交通、運動、演藝與公共空間',
    descriptionEn: 'Transport, sports, performance and public spaces',
  },
];

export const campusLocations: CampusLocation[] = [
  {
    id: 'ug-hall-i',
    label: 'UG Hall I',
    shortLabel: 'Hall I',
    group: 'ug-housing',
    x: 10,
    y: 18,
    size: 104,
  },
  {
    id: 'ug-hall-ii',
    label: 'UG Hall II',
    shortLabel: 'Hall II',
    group: 'ug-housing',
    x: 31,
    y: 9,
    size: 92,
  },
  {
    id: 'ug-hall-iii',
    label: 'UG Hall III',
    shortLabel: 'Hall III',
    group: 'ug-housing',
    x: 52,
    y: 19,
    size: 112,
  },
  {
    id: 'ug-hall-iv',
    label: 'UG Hall IV',
    shortLabel: 'Hall IV',
    group: 'ug-housing',
    x: 76,
    y: 10,
    size: 88,
  },
  {
    id: 'ug-hall-v',
    label: 'UG Hall V / PG Hall II',
    shortLabel: 'Hall V',
    group: 'ug-housing',
    x: 17,
    y: 48,
    size: 108,
  },
  {
    id: 'ug-hall-vi',
    label: 'Jockey Club / S H Ho Tower',
    shortLabel: 'Hall VI',
    group: 'ug-housing',
    x: 42,
    y: 48,
    size: 110,
  },
  {
    id: 'ug-hall-vii',
    label: 'Chan Sui Kau & Chan Lam Moon Chun Hall',
    shortLabel: 'Hall VII',
    group: 'ug-housing',
    x: 69,
    y: 42,
    size: 124,
  },
  {
    id: 'ug-hall-viii',
    label: 'UG Hall VIII',
    shortLabel: 'Hall VIII',
    group: 'ug-housing',
    x: 6,
    y: 78,
    size: 84,
  },
  {
    id: 'ug-hall-ix',
    label: 'UG Hall IX',
    shortLabel: 'Hall IX',
    group: 'ug-housing',
    x: 28,
    y: 78,
    size: 96,
  },
  {
    id: 'ug-hall-x',
    label: 'iVillage · Hall X',
    shortLabel: 'Hall X',
    group: 'ug-housing',
    x: 50,
    y: 78,
    size: 84,
  },
  {
    id: 'ug-hall-xi',
    label: 'iVillage · Hall XI',
    shortLabel: 'Hall XI',
    group: 'ug-housing',
    x: 70,
    y: 75,
    size: 88,
  },
  {
    id: 'ug-hall-xii',
    label: 'iVillage · Hall XII',
    shortLabel: 'Hall XII',
    group: 'ug-housing',
    x: 91,
    y: 35,
    size: 82,
  },
  {
    id: 'ug-hall-xiii',
    label: 'iVillage · Hall XIII',
    shortLabel: 'Hall XIII',
    group: 'ug-housing',
    x: 91,
    y: 78,
    size: 90,
  },

  {
    id: 'pg-hall-i',
    label: 'Stephen Kam Chuen Cheong Hall',
    shortLabel: 'PG Hall I',
    group: 'pg-housing',
    x: 15,
    y: 25,
    size: 124,
  },
  {
    id: 'pg-hall-ii',
    label: 'PG Hall II / UG Hall V',
    shortLabel: 'PG Hall II',
    group: 'pg-housing',
    x: 44,
    y: 15,
    size: 108,
  },
  {
    id: 'ua-a',
    label: 'University Apartments · Tower A',
    shortLabel: 'UA Tower A',
    group: 'pg-housing',
    x: 72,
    y: 25,
    size: 112,
  },
  {
    id: 'ua-b',
    label: 'University Apartments · Tower B',
    shortLabel: 'UA Tower B',
    group: 'pg-housing',
    x: 22,
    y: 68,
    size: 106,
  },
  {
    id: 'ua-cd',
    label: 'University Apartments · Towers C & D',
    shortLabel: 'UA Towers C–D',
    group: 'pg-housing',
    x: 52,
    y: 69,
    size: 124,
  },
  {
    id: 'ggt',
    label: 'Jockey Club Global Graduate Tower',
    shortLabel: 'GGT',
    group: 'pg-housing',
    x: 83,
    y: 66,
    size: 134,
  },

  {
    id: 'sq-1-2',
    label: 'Staff Quarters Towers 1–2',
    shortLabel: 'SQ 1–2',
    group: 'staff-housing',
    x: 16,
    y: 23,
    size: 112,
  },
  {
    id: 'sq-3-4',
    label: 'Staff Quarters Towers 3–4',
    shortLabel: 'SQ 3–4',
    group: 'staff-housing',
    x: 45,
    y: 16,
    size: 108,
  },
  {
    id: 'sq-5-7',
    label: 'Staff Quarters Towers 5–7',
    shortLabel: 'SQ 5–7',
    group: 'staff-housing',
    x: 75,
    y: 24,
    size: 118,
  },
  {
    id: 'sq-8-11',
    label: 'Staff Quarters Towers 8–11',
    shortLabel: 'SQ 8–11',
    group: 'staff-housing',
    x: 22,
    y: 66,
    size: 122,
  },
  {
    id: 'sq-12-14',
    label: 'Staff Quarters Towers 12–14',
    shortLabel: 'SQ 12–14',
    group: 'staff-housing',
    x: 52,
    y: 66,
    size: 120,
  },
  {
    id: 'sq-15-19',
    label: 'Staff Quarters Towers 15–19',
    shortLabel: 'SQ 15–19',
    group: 'staff-housing',
    x: 82,
    y: 65,
    size: 128,
  },
  {
    id: 'sq-houses',
    label: 'Staff Quarters Houses & Apartments',
    shortLabel: 'SQ Houses',
    group: 'staff-housing',
    x: 92,
    y: 88,
    size: 96,
  },

  {
    id: 'academic-building',
    label: 'Academic Building',
    shortLabel: 'Academic Building',
    group: 'academic-core',
    x: 18,
    y: 24,
    size: 132,
  },
  {
    id: 'academic-concourse',
    label: 'Chia-Wei Woo Academic Concourse',
    shortLabel: 'Academic Concourse',
    group: 'academic-core',
    x: 49,
    y: 15,
    size: 122,
  },
  {
    id: 'library',
    label: 'Lee Shau Kee Library',
    shortLabel: 'Library',
    group: 'academic-core',
    x: 79,
    y: 25,
    size: 116,
  },
  {
    id: 'enterprise-centre',
    label: 'Jockey Club Enterprise Center',
    shortLabel: 'Enterprise Center',
    group: 'academic-core',
    x: 26,
    y: 68,
    size: 118,
  },
  {
    id: 'cyt-building',
    label: 'Cheng Yu Tung Building',
    shortLabel: 'CYT Building',
    group: 'academic-core',
    x: 57,
    y: 66,
    size: 126,
  },
  {
    id: 'innovation-building',
    label: 'Martin Ka Shing Lee Innovation Building',
    shortLabel: 'Innovation Building',
    group: 'academic-core',
    x: 86,
    y: 66,
    size: 128,
  },

  {
    id: 'lsk-business-building',
    label: 'Lee Shau Kee Business Building',
    shortLabel: 'LSK Business Building',
    group: 'lsk-campus',
    x: 18,
    y: 27,
    size: 140,
  },
  {
    id: 'ias-building',
    label: 'Jockey Club IAS / Lo Ka Chung Building',
    shortLabel: 'IAS',
    group: 'lsk-campus',
    x: 51,
    y: 18,
    size: 128,
  },
  {
    id: 'conference-lodge',
    label: 'Conference Lodge',
    shortLabel: 'Conference Lodge',
    group: 'lsk-campus',
    x: 81,
    y: 30,
    size: 116,
  },
  {
    id: 'lsk-campus-south',
    label: 'Lee Shau Kee Campus · South',
    shortLabel: 'LSK Campus South',
    group: 'lsk-campus',
    x: 33,
    y: 72,
    size: 124,
  },
  {
    id: 'south-entrance',
    label: 'South Entrance',
    shortLabel: 'South Entrance',
    group: 'lsk-campus',
    x: 70,
    y: 70,
    size: 104,
  },

  {
    id: 'entrance-piazza',
    label: 'Entrance Piazza & Atrium',
    shortLabel: 'Entrance Piazza',
    group: 'campus-life',
    x: 16,
    y: 25,
    size: 132,
  },
  {
    id: 'north-bus-station',
    label: 'North Bus Station',
    shortLabel: 'North Bus Station',
    group: 'campus-life',
    x: 47,
    y: 15,
    size: 104,
  },
  {
    id: 'south-bus-station',
    label: 'South Bus Station',
    shortLabel: 'South Bus Station',
    group: 'campus-life',
    x: 78,
    y: 25,
    size: 104,
  },
  {
    id: 'shaw-auditorium',
    label: 'Shaw Auditorium',
    shortLabel: 'Shaw Auditorium',
    group: 'campus-life',
    x: 20,
    y: 69,
    size: 120,
  },
  {
    id: 'sports-centres',
    label: 'Sports Centres & Swimming Pools',
    shortLabel: 'Sports Centres',
    group: 'campus-life',
    x: 52,
    y: 66,
    size: 132,
  },
  {
    id: 'waterfront',
    label: 'Waterfront, BBQ & Amphitheater',
    shortLabel: 'Waterfront',
    group: 'campus-life',
    x: 83,
    y: 68,
    size: 126,
  },
];

export const campusLocationIds = new Set(
  campusLocations.map((location) => location.id),
);

export function getCampusLocation(id: string | null | undefined) {
  return campusLocations.find((location) => location.id === id);
}

const locationShortTranslations: Record<
  string,
  { 'zh-CN': string; 'zh-HK': string }
> = {
  'academic-building': { 'zh-CN': '学术大楼', 'zh-HK': '學術大樓' },
  'academic-concourse': { 'zh-CN': '学术廊', 'zh-HK': '學術廊' },
  library: { 'zh-CN': '图书馆', 'zh-HK': '圖書館' },
  'enterprise-centre': { 'zh-CN': '创业中心', 'zh-HK': '創業中心' },
  'cyt-building': { 'zh-CN': '郑裕彤楼', 'zh-HK': '鄭裕彤樓' },
  'innovation-building': { 'zh-CN': '创科大楼', 'zh-HK': '創科大樓' },
  'lsk-business-building': { 'zh-CN': '商学大楼', 'zh-HK': '商學大樓' },
  'conference-lodge': { 'zh-CN': '会议大楼', 'zh-HK': '會議大樓' },
  'lsk-campus-south': { 'zh-CN': 'LSK 南区', 'zh-HK': 'LSK 南區' },
  'south-entrance': { 'zh-CN': '南门', 'zh-HK': '南門' },
  'entrance-piazza': { 'zh-CN': '入口广场', 'zh-HK': '入口廣場' },
  'north-bus-station': { 'zh-CN': '北门车站', 'zh-HK': '北門車站' },
  'south-bus-station': { 'zh-CN': '南门车站', 'zh-HK': '南門車站' },
  'shaw-auditorium': { 'zh-CN': '逸夫演艺中心', 'zh-HK': '逸夫演藝中心' },
  'sports-centres': { 'zh-CN': '运动中心', 'zh-HK': '運動中心' },
  waterfront: { 'zh-CN': '海旁休闲区', 'zh-HK': '海旁休閒區' },
};

export function getCampusLocationLabel(
  location: CampusLocation | undefined,
  locale: CampusLocale,
  short = true,
) {
  if (!location) return '';
  if (locale === 'en') return short ? location.shortLabel : location.label;
  return (
    locationShortTranslations[location.id]?.[locale] ??
    (short ? location.shortLabel : location.label)
  );
}

export function getLocationGroupLabel(
  group: (typeof locationGroups)[number],
  locale: CampusLocale,
) {
  if (locale === 'en') return group.labelEn;
  return locale === 'zh-HK' ? group.labelZhHk : group.label;
}

export function getLocationGroupDescription(
  group: (typeof locationGroups)[number],
  locale: CampusLocale,
) {
  if (locale === 'en') return group.descriptionEn;
  return locale === 'zh-HK' ? group.descriptionZhHk : group.description;
}

export function getLocationForHall(hall: string | null | undefined) {
  if (!hall) return undefined;
  const normalized = hall.toLowerCase().replaceAll(' ', '');
  return campusLocations.find((location) => {
    if (!location.group.endsWith('housing')) return false;
    return [location.label, location.shortLabel]
      .map((value) => value.toLowerCase().replaceAll(' ', ''))
      .some(
        (value) => value.includes(normalized) || normalized.includes(value),
      );
  });
}
