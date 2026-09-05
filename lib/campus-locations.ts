export type LocationGroupId =
  | 'ug-housing'
  | 'pg-housing'
  | 'staff-housing'
  | 'academic-core'
  | 'lsk-campus'
  | 'campus-life';

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
  labelEn: string;
  description: string;
}> = [
  {
    id: 'ug-housing',
    label: '本科生宿舍',
    labelEn: 'UG Halls',
    description: 'Hall I–XIII 与赛马会大楼',
  },
  {
    id: 'pg-housing',
    label: '研究生宿舍',
    labelEn: 'PG Housing',
    description: 'PG Hall、University Apartments 与 GGT',
  },
  {
    id: 'staff-housing',
    label: '教职员宿舍',
    labelEn: 'Staff Quarters',
    description: '按官方校园图分组展示 Staff Quarters',
  },
  {
    id: 'academic-core',
    label: '教学区',
    labelEn: 'Academic Core',
    description: '学术大楼、图书馆与主要教学设施',
  },
  {
    id: 'lsk-campus',
    label: '李兆基校区',
    labelEn: 'LSK Campus',
    description: '商学院、IAS 与南门一带',
  },
  {
    id: 'campus-life',
    label: '校园生活',
    labelEn: 'Campus Life',
    description: '交通、运动、演艺与公共空间',
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
    shortLabel: '学术大楼',
    group: 'academic-core',
    x: 18,
    y: 24,
    size: 132,
  },
  {
    id: 'academic-concourse',
    label: 'Chia-Wei Woo Academic Concourse',
    shortLabel: '学术廊',
    group: 'academic-core',
    x: 49,
    y: 15,
    size: 122,
  },
  {
    id: 'library',
    label: 'Lee Shau Kee Library',
    shortLabel: '图书馆',
    group: 'academic-core',
    x: 79,
    y: 25,
    size: 116,
  },
  {
    id: 'enterprise-centre',
    label: 'Jockey Club Enterprise Center',
    shortLabel: '创业中心',
    group: 'academic-core',
    x: 26,
    y: 68,
    size: 118,
  },
  {
    id: 'cyt-building',
    label: 'Cheng Yu Tung Building',
    shortLabel: '郑裕彤楼',
    group: 'academic-core',
    x: 57,
    y: 66,
    size: 126,
  },
  {
    id: 'innovation-building',
    label: 'Martin Ka Shing Lee Innovation Building',
    shortLabel: '创科大楼',
    group: 'academic-core',
    x: 86,
    y: 66,
    size: 128,
  },

  {
    id: 'lsk-business-building',
    label: 'Lee Shau Kee Business Building',
    shortLabel: '商学大楼',
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
    shortLabel: '会议大楼',
    group: 'lsk-campus',
    x: 81,
    y: 30,
    size: 116,
  },
  {
    id: 'lsk-campus-south',
    label: 'Lee Shau Kee Campus · South',
    shortLabel: 'LSK 南区',
    group: 'lsk-campus',
    x: 33,
    y: 72,
    size: 124,
  },
  {
    id: 'south-entrance',
    label: 'South Entrance',
    shortLabel: '南门',
    group: 'lsk-campus',
    x: 70,
    y: 70,
    size: 104,
  },

  {
    id: 'entrance-piazza',
    label: 'Entrance Piazza & Atrium',
    shortLabel: '入口广场',
    group: 'campus-life',
    x: 16,
    y: 25,
    size: 132,
  },
  {
    id: 'north-bus-station',
    label: 'North Bus Station',
    shortLabel: '北门车站',
    group: 'campus-life',
    x: 47,
    y: 15,
    size: 104,
  },
  {
    id: 'south-bus-station',
    label: 'South Bus Station',
    shortLabel: '南门车站',
    group: 'campus-life',
    x: 78,
    y: 25,
    size: 104,
  },
  {
    id: 'shaw-auditorium',
    label: 'Shaw Auditorium',
    shortLabel: '逸夫演艺中心',
    group: 'campus-life',
    x: 20,
    y: 69,
    size: 120,
  },
  {
    id: 'sports-centres',
    label: 'Sports Centres & Swimming Pools',
    shortLabel: '运动中心',
    group: 'campus-life',
    x: 52,
    y: 66,
    size: 132,
  },
  {
    id: 'waterfront',
    label: 'Waterfront, BBQ & Amphitheater',
    shortLabel: '海旁休闲区',
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
