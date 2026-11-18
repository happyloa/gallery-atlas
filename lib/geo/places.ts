/**
 * Map positions for the museum's most common places of origin. `key` is the API's
 * `place_of_origin.keyword` value (lowercase, as its aggregations return it); positions
 * are approximate centres. Vague entries ("europe", "mediterranean region") are left off
 * the map on purpose. Counts come live from the API; this table only places them.
 */
export interface Place {
  key: string;
  lat: number;
  lon: number;
  en: string;
  zh: string;
}

export const PLACES: readonly Place[] = [
  { key: "france", lat: 46.6, lon: 2.4, en: "France", zh: "法國" },
  { key: "japan", lat: 36.2, lon: 138.3, en: "Japan", zh: "日本" },
  { key: "england", lat: 52.5, lon: -1.5, en: "England", zh: "英格蘭" },
  {
    key: "united states",
    lat: 39.5,
    lon: -98.4,
    en: "United States",
    zh: "美國",
  },
  { key: "italy", lat: 42.8, lon: 12.6, en: "Italy", zh: "義大利" },
  { key: "germany", lat: 51.2, lon: 10.4, en: "Germany", zh: "德國" },
  { key: "china", lat: 35.0, lon: 104.2, en: "China", zh: "中國" },
  { key: "netherlands", lat: 52.2, lon: 5.5, en: "Netherlands", zh: "荷蘭" },
  { key: "egypt", lat: 26.8, lon: 30.8, en: "Egypt", zh: "埃及" },
  { key: "flanders", lat: 51.0, lon: 3.7, en: "Flanders", zh: "法蘭德斯" },
  { key: "holland", lat: 52.4, lon: 4.8, en: "Holland", zh: "荷蘭地區" },
  { key: "peru", lat: -9.2, lon: -75.0, en: "Peru", zh: "秘魯" },
  {
    key: "roman empire",
    lat: 41.9,
    lon: 12.5,
    en: "Roman Empire",
    zh: "羅馬帝國",
  },
  { key: "spain", lat: 40.4, lon: -3.7, en: "Spain", zh: "西班牙" },
  { key: "sweden", lat: 62.0, lon: 15.0, en: "Sweden", zh: "瑞典" },
  { key: "scotland", lat: 56.5, lon: -4.2, en: "Scotland", zh: "蘇格蘭" },
  { key: "mexico", lat: 23.6, lon: -102.6, en: "Mexico", zh: "墨西哥" },
  {
    key: "united kingdom",
    lat: 54.0,
    lon: -2.5,
    en: "United Kingdom",
    zh: "英國",
  },
  {
    key: "peruvian north coast",
    lat: -7.5,
    lon: -79.5,
    en: "Peruvian north coast",
    zh: "秘魯北部海岸",
  },
  { key: "bohemia", lat: 49.8, lon: 15.0, en: "Bohemia", zh: "波希米亞" },
  { key: "india", lat: 21.0, lon: 78.0, en: "India", zh: "印度" },
  {
    key: "staffordshire",
    lat: 52.8,
    lon: -2.0,
    en: "Staffordshire",
    zh: "斯塔福郡",
  },
  { key: "greece", lat: 39.1, lon: 21.8, en: "Greece", zh: "希臘" },
  { key: "iran", lat: 32.4, lon: 53.7, en: "Iran", zh: "伊朗" },
  { key: "turkey", lat: 39.0, lon: 35.2, en: "Turkey", zh: "土耳其" },
  {
    key: "ancient greece",
    lat: 37.97,
    lon: 23.72,
    en: "Ancient Greece",
    zh: "古希臘",
  },
  { key: "switzerland", lat: 46.8, lon: 8.2, en: "Switzerland", zh: "瑞士" },
  { key: "austria", lat: 47.5, lon: 14.5, en: "Austria", zh: "奧地利" },
  { key: "belgium", lat: 50.5, lon: 4.5, en: "Belgium", zh: "比利時" },
  { key: "syria", lat: 34.8, lon: 38.9, en: "Syria", zh: "敘利亞" },
  { key: "london", lat: 51.5, lon: -0.13, en: "London", zh: "倫敦" },
  { key: "chicago", lat: 41.88, lon: -87.63, en: "Chicago", zh: "芝加哥" },
  { key: "korea", lat: 36.5, lon: 127.8, en: "Korea", zh: "韓國" },
  {
    key: "new york city",
    lat: 40.71,
    lon: -74.0,
    en: "New York City",
    zh: "紐約市",
  },
  { key: "florence", lat: 43.77, lon: 11.25, en: "Florence", zh: "佛羅倫斯" },
  {
    key: "nazca valley",
    lat: -14.8,
    lon: -74.9,
    en: "Nazca Valley",
    zh: "納斯卡河谷",
  },
  {
    key: "philadelphia",
    lat: 39.95,
    lon: -75.17,
    en: "Philadelphia",
    zh: "費城",
  },
  { key: "norway", lat: 61.0, lon: 8.5, en: "Norway", zh: "挪威" },
  { key: "paris", lat: 48.86, lon: 2.35, en: "Paris", zh: "巴黎" },
  { key: "tibet", lat: 31.0, lon: 88.0, en: "Tibet", zh: "西藏" },
  { key: "rome", lat: 41.9, lon: 12.5, en: "Rome", zh: "羅馬" },
  { key: "meissen", lat: 51.16, lon: 13.47, en: "Meissen", zh: "邁森" },
  { key: "russia", lat: 56.0, lon: 40.0, en: "Russia", zh: "俄羅斯" },
  { key: "boston", lat: 42.36, lon: -71.06, en: "Boston", zh: "波士頓" },
  { key: "venice", lat: 45.44, lon: 12.32, en: "Venice", zh: "威尼斯" },
  { key: "vienna", lat: 48.21, lon: 16.37, en: "Vienna", zh: "維也納" },
  { key: "ireland", lat: 53.4, lon: -8.0, en: "Ireland", zh: "愛爾蘭" },
  { key: "nepal", lat: 28.4, lon: 84.1, en: "Nepal", zh: "尼泊爾" },
  { key: "brussels", lat: 50.85, lon: 4.35, en: "Brussels", zh: "布魯塞爾" },
  { key: "lyon", lat: 45.76, lon: 4.84, en: "Lyon", zh: "里昂" },
  { key: "nuremberg", lat: 49.45, lon: 11.08, en: "Nuremberg", zh: "紐倫堡" },
  { key: "augsburg", lat: 48.37, lon: 10.9, en: "Augsburg", zh: "奧格斯堡" },
  { key: "milan", lat: 45.46, lon: 9.19, en: "Milan", zh: "米蘭" },
  { key: "delft", lat: 52.01, lon: 4.36, en: "Delft", zh: "台夫特" },
];

export function placeByKey(key: string | null | undefined): Place | null {
  if (!key) return null;
  const lower = key.toLowerCase();
  return PLACES.find((p) => p.key === lower) ?? null;
}
