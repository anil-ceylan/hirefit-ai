/**
 * Reusable location data: countries (ISO code + TR/EN labels) and cities by country code.
 */

const TR_DISPLAY =
  typeof Intl !== "undefined" ? new Intl.DisplayNames(["tr"], { type: "region" }) : null;

/** Manual overrides where Intl differs from product copy */
const NAME_TR_OVERRIDES = {
  TR: "Türkiye",
  CY: "Kuzey Kıbrıs Türk Cumhuriyeti",
  GB: "Birleşik Krallık",
  US: "Amerika Birleşik Devletleri",
  AE: "Birleşik Arap Emirlikleri",
  NL: "Hollanda",
  KR: "Güney Kore",
  KP: "Kuzey Kore",
  CZ: "Çekya",
  VA: "Vatikan",
  MK: "Kuzey Makedonya",
  PS: "Filistin",
  TW: "Tayvan",
};

const RAW_COUNTRIES = [
  { code: "AF", nameEN: "Afghanistan" },
  { code: "AL", nameEN: "Albania" },
  { code: "DZ", nameEN: "Algeria" },
  { code: "AD", nameEN: "Andorra" },
  { code: "AO", nameEN: "Angola" },
  { code: "AG", nameEN: "Antigua and Barbuda" },
  { code: "AR", nameEN: "Argentina" },
  { code: "AM", nameEN: "Armenia" },
  { code: "AU", nameEN: "Australia" },
  { code: "AT", nameEN: "Austria" },
  { code: "AZ", nameEN: "Azerbaijan" },
  { code: "BS", nameEN: "Bahamas" },
  { code: "BH", nameEN: "Bahrain" },
  { code: "BD", nameEN: "Bangladesh" },
  { code: "BB", nameEN: "Barbados" },
  { code: "BY", nameEN: "Belarus" },
  { code: "BE", nameEN: "Belgium" },
  { code: "BZ", nameEN: "Belize" },
  { code: "BJ", nameEN: "Benin" },
  { code: "BT", nameEN: "Bhutan" },
  { code: "BO", nameEN: "Bolivia" },
  { code: "BA", nameEN: "Bosnia and Herzegovina" },
  { code: "BW", nameEN: "Botswana" },
  { code: "BR", nameEN: "Brazil" },
  { code: "BN", nameEN: "Brunei" },
  { code: "BG", nameEN: "Bulgaria" },
  { code: "BF", nameEN: "Burkina Faso" },
  { code: "BI", nameEN: "Burundi" },
  { code: "CV", nameEN: "Cabo Verde" },
  { code: "KH", nameEN: "Cambodia" },
  { code: "CM", nameEN: "Cameroon" },
  { code: "CA", nameEN: "Canada" },
  { code: "CF", nameEN: "Central African Republic" },
  { code: "TD", nameEN: "Chad" },
  { code: "CL", nameEN: "Chile" },
  { code: "CN", nameEN: "China" },
  { code: "CO", nameEN: "Colombia" },
  { code: "KM", nameEN: "Comoros" },
  { code: "CG", nameEN: "Congo" },
  { code: "CR", nameEN: "Costa Rica" },
  { code: "HR", nameEN: "Croatia" },
  { code: "CU", nameEN: "Cuba" },
  { code: "CY", nameEN: "Cyprus" },
  { code: "CZ", nameEN: "Czech Republic" },
  { code: "DK", nameEN: "Denmark" },
  { code: "DJ", nameEN: "Djibouti" },
  { code: "DM", nameEN: "Dominica" },
  { code: "DO", nameEN: "Dominican Republic" },
  { code: "EC", nameEN: "Ecuador" },
  { code: "EG", nameEN: "Egypt" },
  { code: "SV", nameEN: "El Salvador" },
  { code: "GQ", nameEN: "Equatorial Guinea" },
  { code: "ER", nameEN: "Eritrea" },
  { code: "EE", nameEN: "Estonia" },
  { code: "SZ", nameEN: "Eswatini" },
  { code: "ET", nameEN: "Ethiopia" },
  { code: "FJ", nameEN: "Fiji" },
  { code: "FI", nameEN: "Finland" },
  { code: "FR", nameEN: "France" },
  { code: "GA", nameEN: "Gabon" },
  { code: "GM", nameEN: "Gambia" },
  { code: "GE", nameEN: "Georgia" },
  { code: "DE", nameEN: "Germany" },
  { code: "GH", nameEN: "Ghana" },
  { code: "GR", nameEN: "Greece" },
  { code: "GD", nameEN: "Grenada" },
  { code: "GT", nameEN: "Guatemala" },
  { code: "GN", nameEN: "Guinea" },
  { code: "GW", nameEN: "Guinea-Bissau" },
  { code: "GY", nameEN: "Guyana" },
  { code: "HT", nameEN: "Haiti" },
  { code: "HN", nameEN: "Honduras" },
  { code: "HU", nameEN: "Hungary" },
  { code: "IS", nameEN: "Iceland" },
  { code: "IN", nameEN: "India" },
  { code: "ID", nameEN: "Indonesia" },
  { code: "IR", nameEN: "Iran" },
  { code: "IQ", nameEN: "Iraq" },
  { code: "IE", nameEN: "Ireland" },
  { code: "IL", nameEN: "Israel" },
  { code: "IT", nameEN: "Italy" },
  { code: "JM", nameEN: "Jamaica" },
  { code: "JP", nameEN: "Japan" },
  { code: "JO", nameEN: "Jordan" },
  { code: "KZ", nameEN: "Kazakhstan" },
  { code: "KE", nameEN: "Kenya" },
  { code: "KI", nameEN: "Kiribati" },
  { code: "KW", nameEN: "Kuwait" },
  { code: "KG", nameEN: "Kyrgyzstan" },
  { code: "LA", nameEN: "Laos" },
  { code: "LV", nameEN: "Latvia" },
  { code: "LB", nameEN: "Lebanon" },
  { code: "LS", nameEN: "Lesotho" },
  { code: "LR", nameEN: "Liberia" },
  { code: "LY", nameEN: "Libya" },
  { code: "LI", nameEN: "Liechtenstein" },
  { code: "LT", nameEN: "Lithuania" },
  { code: "LU", nameEN: "Luxembourg" },
  { code: "MG", nameEN: "Madagascar" },
  { code: "MW", nameEN: "Malawi" },
  { code: "MY", nameEN: "Malaysia" },
  { code: "MV", nameEN: "Maldives" },
  { code: "ML", nameEN: "Mali" },
  { code: "MT", nameEN: "Malta" },
  { code: "MH", nameEN: "Marshall Islands" },
  { code: "MR", nameEN: "Mauritania" },
  { code: "MU", nameEN: "Mauritius" },
  { code: "MX", nameEN: "Mexico" },
  { code: "FM", nameEN: "Micronesia" },
  { code: "MD", nameEN: "Moldova" },
  { code: "MC", nameEN: "Monaco" },
  { code: "MN", nameEN: "Mongolia" },
  { code: "ME", nameEN: "Montenegro" },
  { code: "MA", nameEN: "Morocco" },
  { code: "MZ", nameEN: "Mozambique" },
  { code: "MM", nameEN: "Myanmar" },
  { code: "NA", nameEN: "Namibia" },
  { code: "NR", nameEN: "Nauru" },
  { code: "NP", nameEN: "Nepal" },
  { code: "NL", nameEN: "Netherlands" },
  { code: "NZ", nameEN: "New Zealand" },
  { code: "NI", nameEN: "Nicaragua" },
  { code: "NE", nameEN: "Niger" },
  { code: "NG", nameEN: "Nigeria" },
  { code: "KP", nameEN: "North Korea" },
  { code: "MK", nameEN: "North Macedonia" },
  { code: "NO", nameEN: "Norway" },
  { code: "OM", nameEN: "Oman" },
  { code: "PK", nameEN: "Pakistan" },
  { code: "PW", nameEN: "Palau" },
  { code: "PS", nameEN: "Palestine" },
  { code: "PA", nameEN: "Panama" },
  { code: "PG", nameEN: "Papua New Guinea" },
  { code: "PY", nameEN: "Paraguay" },
  { code: "PE", nameEN: "Peru" },
  { code: "PH", nameEN: "Philippines" },
  { code: "PL", nameEN: "Poland" },
  { code: "PT", nameEN: "Portugal" },
  { code: "QA", nameEN: "Qatar" },
  { code: "RO", nameEN: "Romania" },
  { code: "RU", nameEN: "Russia" },
  { code: "RW", nameEN: "Rwanda" },
  { code: "KN", nameEN: "Saint Kitts and Nevis" },
  { code: "LC", nameEN: "Saint Lucia" },
  { code: "VC", nameEN: "Saint Vincent and the Grenadines" },
  { code: "WS", nameEN: "Samoa" },
  { code: "SM", nameEN: "San Marino" },
  { code: "ST", nameEN: "Sao Tome and Principe" },
  { code: "SA", nameEN: "Saudi Arabia" },
  { code: "SN", nameEN: "Senegal" },
  { code: "RS", nameEN: "Serbia" },
  { code: "SC", nameEN: "Seychelles" },
  { code: "SL", nameEN: "Sierra Leone" },
  { code: "SG", nameEN: "Singapore" },
  { code: "SK", nameEN: "Slovakia" },
  { code: "SI", nameEN: "Slovenia" },
  { code: "SB", nameEN: "Solomon Islands" },
  { code: "SO", nameEN: "Somalia" },
  { code: "ZA", nameEN: "South Africa" },
  { code: "KR", nameEN: "South Korea" },
  { code: "SS", nameEN: "South Sudan" },
  { code: "ES", nameEN: "Spain" },
  { code: "LK", nameEN: "Sri Lanka" },
  { code: "SD", nameEN: "Sudan" },
  { code: "SR", nameEN: "Suriname" },
  { code: "SE", nameEN: "Sweden" },
  { code: "CH", nameEN: "Switzerland" },
  { code: "SY", nameEN: "Syria" },
  { code: "TW", nameEN: "Taiwan" },
  { code: "TJ", nameEN: "Tajikistan" },
  { code: "TZ", nameEN: "Tanzania" },
  { code: "TH", nameEN: "Thailand" },
  { code: "TL", nameEN: "Timor-Leste" },
  { code: "TG", nameEN: "Togo" },
  { code: "TO", nameEN: "Tonga" },
  { code: "TT", nameEN: "Trinidad and Tobago" },
  { code: "TN", nameEN: "Tunisia" },
  { code: "TR", nameEN: "Turkey" },
  { code: "TM", nameEN: "Turkmenistan" },
  { code: "TV", nameEN: "Tuvalu" },
  { code: "UG", nameEN: "Uganda" },
  { code: "UA", nameEN: "Ukraine" },
  { code: "AE", nameEN: "United Arab Emirates" },
  { code: "GB", nameEN: "United Kingdom" },
  { code: "US", nameEN: "United States" },
  { code: "UY", nameEN: "Uruguay" },
  { code: "UZ", nameEN: "Uzbekistan" },
  { code: "VU", nameEN: "Vanuatu" },
  { code: "VA", nameEN: "Vatican City" },
  { code: "VE", nameEN: "Venezuela" },
  { code: "VN", nameEN: "Vietnam" },
  { code: "YE", nameEN: "Yemen" },
  { code: "ZM", nameEN: "Zambia" },
  { code: "ZW", nameEN: "Zimbabwe" },
];

function buildNameTR(code, nameEN) {
  if (NAME_TR_OVERRIDES[code]) return NAME_TR_OVERRIDES[code];
  try {
    const fromIntl = TR_DISPLAY?.of(code);
    if (fromIntl && fromIntl !== code) return fromIntl;
  } catch {
    /* ignore */
  }
  return nameEN;
}

export const COUNTRIES = RAW_COUNTRIES.map(({ code, nameEN }) => ({
  code,
  nameEN,
  nameTR: buildNameTR(code, nameEN),
}));

const CODE_SET = new Set(COUNTRIES.map((c) => c.code));
const LOOKUP = {};
for (const c of COUNTRIES) {
  LOOKUP[c.code] = c.code;
  LOOKUP[c.code.toLowerCase()] = c.code;
  LOOKUP[c.nameEN.toLowerCase()] = c.code;
  LOOKUP[c.nameTR.toLowerCase()] = c.code;
}
LOOKUP.turkey = "TR";
LOOKUP.türkiye = "TR";
LOOKUP.cyprus = "CY";
LOOKUP.kibris = "CY";
LOOKUP.kıbrıs = "CY";
LOOKUP["kuzey kibris"] = "CY";
LOOKUP["kuzey kıbrıs"] = "CY";
LOOKUP.kktc = "CY";
LOOKUP["kuzey kibris turk cumhuriyeti"] = "CY";
LOOKUP["kuzey kıbrıs türk cumhuriyeti"] = "CY";

/** Country codes where residence city is required */
export const RESIDENCE_CITY_REQUIRED_CODES = ["TR", "CY"];

/** @type {Record<string, string[]>} */
export const CITIES_BY_COUNTRY = {
  TR: [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
    "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
    "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
    "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
    "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir",
    "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
    "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas",
    "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat",
    "Zonguldak",
  ],
  CY: ["Lefkoşa", "Gazimağusa", "Girne", "Güzelyurt", "İskele", "Lefke"],
  US: ["New York", "San Francisco", "Los Angeles", "Seattle", "Boston", "Chicago", "Austin", "Miami"],
  GB: ["Londra", "Manchester", "Birmingham", "Edinburgh", "Glasgow"],
  DE: ["Berlin", "Münih", "Hamburg", "Frankfurt", "Köln", "Düsseldorf"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven"],
  FR: ["Paris", "Lyon", "Marsilya", "Nice"],
  IT: ["Roma", "Milano", "Torino", "Floransa"],
  ES: ["Madrid", "Barselona", "Valencia"],
  CA: ["Toronto", "Vancouver", "Montreal"],
  AE: ["Dubai", "Abu Dabi"],
  IE: ["Dublin"],
  SE: ["Stockholm"],
  CH: ["Zürih", "Cenevre"],
  PL: ["Varşova", "Kraków"],
};

export const UNIVERSITIES_BY_LOCATION = {
  CY: {
    Lefkoşa: [
      "Yakın Doğu Üniversitesi",
      "Uluslararası Kıbrıs Üniversitesi",
      "Kıbrıs İlim Üniversitesi",
      "Akdeniz Karpaz Üniversitesi",
      "Altınbaş Kıbrıs Üniversitesi",
      "Ankara Sosyal Bilimler Üniversitesi",
      "Avrupa Liderlik Üniversitesi",
      "Kıbrıs Amerikan Üniversitesi",
      "Kıbrıs Aydın Üniversitesi",
      "Onbeş Kasım Kıbrıs Üniversitesi",
      "Rauf Denktaş Üniversitesi",
    ],
    Gazimağusa: [
      "Doğu Akdeniz Üniversitesi",
      "Ada Kent Üniversitesi",
      "Uluslararası Alasya Üniversitesi",
    ],
    Girne: [
      "Girne Amerikan Üniversitesi",
      "Girne Üniversitesi",
      "Uluslararası Final Üniversitesi",
      "Arkın Yaratıcı Sanatlar ve Tasarım Üniversitesi",
      "Bahçeşehir Kıbrıs Üniversitesi",
    ],
    Güzelyurt: [
      "Kıbrıs Sağlık ve Toplum Bilimleri Üniversitesi",
      "ODTÜ Kuzey Kıbrıs Kampüsü",
    ],
    İskele: [
      "Kıbrıs Batı Üniversitesi",
      "İTÜ-KKTC Eğitim Araştırma Yerleşkeleri",
    ],
    Lefke: [
      "Lefke Avrupa Üniversitesi",
    ],
  },
  TR: {
    İstanbul: [
      "Boğaziçi Üniversitesi",
      "İstanbul Teknik Üniversitesi",
      "İstanbul Üniversitesi-Cerrahpaşa",
      "Yıldız Teknik Üniversitesi",
      "Marmara Üniversitesi",
      "İstanbul Üniversitesi",
      "İstanbul Medeniyet Üniversitesi",
      "Mimar Sinan Güzel Sanatlar Üniversitesi",
      "Türk-Alman Üniversitesi",
      "Türk-Japon Bilim ve Teknoloji Üniversitesi",
      "Sağlık Bilimleri Üniversitesi",
      "Sabancı Üniversitesi",
      "Koç Üniversitesi",
      "Galatasaray Üniversitesi",
      "Acıbadem Üniversitesi",
      "Altınbaş Üniversitesi",
      "Özyeğin Üniversitesi",
      "Bahçeşehir Üniversitesi",
      "Beykoz Üniversitesi",
      "Bezmialem Vakıf Üniversitesi",
      "Biruni Üniversitesi",
      "Demiroğlu Bilim Üniversitesi",
      "Doğuş Üniversitesi",
      "Fatih Sultan Mehmet Vakıf Üniversitesi",
      "Fenerbahçe Üniversitesi",
      "Haliç Üniversitesi",
      "İbn Haldun Üniversitesi",
      "İstanbul 29 Mayıs Üniversitesi",
      "İstanbul Arel Üniversitesi",
      "İstanbul Atlas Üniversitesi",
      "İstanbul Aydın Üniversitesi",
      "İstanbul Beykent Üniversitesi",
      "İstanbul Bilgi Üniversitesi",
      "İstanbul Ticaret Üniversitesi",
      "İstanbul Esenyurt Üniversitesi",
      "İstanbul Galata Üniversitesi",
      "İstanbul Gedik Üniversitesi",
      "İstanbul Gelişim Üniversitesi",
      "İstanbul Sağlık ve Teknoloji Üniversitesi",
      "İstanbul Kent Üniversitesi",
      "İstanbul Kültür Üniversitesi",
      "İstanbul Medipol Üniversitesi",
      "İstanbul Nişantaşı Üniversitesi",
      "İstanbul Okan Üniversitesi",
      "İstanbul Rumeli Üniversitesi",
      "İstanbul Sabahattin Zaim Üniversitesi",
      "İstanbul Topkapı Üniversitesi",
      "İstanbul Yeni Yüzyıl Üniversitesi",
      "Işık Üniversitesi",
      "İstinye Üniversitesi",
      "Kadir Has Üniversitesi",
      "Maltepe Üniversitesi",
      "MEF Üniversitesi",
      "Piri Reis Üniversitesi",
      "Üsküdar Üniversitesi",
      "Yeditepe Üniversitesi",
    ],
    Ankara: [
      "Orta Doğu Teknik Üniversitesi",
      "Bilkent Üniversitesi",
      "Hacettepe Üniversitesi",
      "Ankara Üniversitesi",
      "Gazi Üniversitesi",
      "TOBB Ekonomi ve Teknoloji Üniversitesi",
      "Çankaya Üniversitesi",
      "TED Üniversitesi",
    ],
    İzmir: [
      "Ege Üniversitesi",
      "Dokuz Eylül Üniversitesi",
      "İzmir Yüksek Teknoloji Enstitüsü",
      "Yaşar Üniversitesi",
      "İzmir Ekonomi Üniversitesi",
    ],
    Bursa: [
      "Bursa Uludağ Üniversitesi",
      "Bursa Teknik Üniversitesi",
    ],
    Antalya: [
      "Akdeniz Üniversitesi",
      "Alanya Alaaddin Keykubat Üniversitesi",
      "Antalya Bilim Üniversitesi",
    ],
  },
  DE: {
    Berlin: ["Humboldt Üniversitesi", "Freie Universität Berlin", "Technische Universität Berlin"],
    Münih: ["Ludwig Maximilian Üniversitesi", "Technische Universität München"],
  },
  GB: {
    Londra: ["University College London", "Imperial College London", "King's College London", "London School of Economics"],
    Manchester: ["University of Manchester", "Manchester Metropolitan University"],
  },
  US: {
    "New York": ["Columbia University", "New York University", "The City University of New York"],
    "San Francisco": ["University of San Francisco", "San Francisco State University"],
    Boston: ["Harvard University", "Massachusetts Institute of Technology", "Boston University"],
  },
  CA: {
    Toronto: ["University of Toronto", "Toronto Metropolitan University", "York University"],
    Vancouver: ["University of British Columbia", "Simon Fraser University"],
    Montreal: ["McGill University", "Université de Montréal", "Concordia University"],
  },
};

export const UNIVERSITY_ALIASES = {
  "Doğu Akdeniz Üniversitesi": ["DAÜ", "DAU", "EMU", "Eastern Mediterranean University", "Dogu Akdeniz Universitesi"],
  "Yakın Doğu Üniversitesi": ["YDÜ", "YDU", "NEU", "Near East University", "Yakin Dogu Universitesi"],
  "Girne Amerikan Üniversitesi": ["GAÜ", "GAU", "Girne American University", "American University of Girne"],
  "Uluslararası Kıbrıs Üniversitesi": ["UKÜ", "UKU", "CIU", "Cyprus International University"],
  "Lefke Avrupa Üniversitesi": ["LAÜ", "LAU", "EUL", "European University of Lefke"],
  "Kıbrıs Sağlık ve Toplum Bilimleri Üniversitesi": ["KSTÜ", "KSTU", "Cyprus Health and Social Sciences University"],
  "Uluslararası Final Üniversitesi": ["Final International University", "FIU", "UFÜ", "UFU"],
  "Arkın Yaratıcı Sanatlar ve Tasarım Üniversitesi": ["ARUCAD", "Arkin University of Creative Arts and Design"],
  "Bahçeşehir Kıbrıs Üniversitesi": ["BAU Cyprus", "Bahcesehir Cyprus University", "Bahçeşehir Cyprus University"],
  "Kıbrıs İlim Üniversitesi": ["Cyprus Science University", "CSU"],
  "Girne Üniversitesi": ["University of Kyrenia", "KU"],
  "ODTÜ Kuzey Kıbrıs Kampüsü": ["METU NCC", "METU Northern Cyprus Campus", "ODTU Kuzey Kibris Kampusu"],
  "İTÜ-KKTC Eğitim Araştırma Yerleşkeleri": ["ITU TRNC", "İTÜ KKTC", "ITU Northern Cyprus"],
  "Boğaziçi Üniversitesi": ["Bogazici University", "Boğaziçi", "Bogazici", "BU"],
  "İstanbul Teknik Üniversitesi": ["ITU", "İTÜ", "Istanbul Technical University"],
  "Yıldız Teknik Üniversitesi": ["YTU", "YTÜ", "Yildiz Technical University", "Yildiz Teknik Universitesi"],
  "Orta Doğu Teknik Üniversitesi": ["ODTÜ", "ODTU", "METU", "Middle East Technical University"],
  "Koç Üniversitesi": ["Koc University", "Koç University"],
  "Sabancı Üniversitesi": ["Sabanci University", "Sabancı University"],
  "Bilkent Üniversitesi": ["Bilkent University"],
  "İstanbul Üniversitesi": ["Istanbul University"],
  "İstanbul Üniversitesi-Cerrahpaşa": ["Istanbul University-Cerrahpasa", "İÜC", "IUC"],
  "Marmara Üniversitesi": ["Marmara University"],
  "İzmir Yüksek Teknoloji Enstitüsü": ["IYTE", "İYTE", "Izmir Institute of Technology"],
};

export const countries = COUNTRIES;
export const citiesByCountry = CITIES_BY_COUNTRY;

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function universitySearchTokens(name) {
  const aliases = UNIVERSITY_ALIASES[name] || [];
  return [name, ...aliases].map(normalizeSearchText).filter(Boolean);
}

function matchesUniversityQuery(name, query) {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const qTokens = q.split(" ").filter(Boolean);
  return universitySearchTokens(name).some((candidate) => {
    if (candidate.includes(q)) return true;
    const candidateTokens = candidate.split(" ").filter(Boolean);
    return qTokens.every((token) => candidateTokens.some((part) => part.startsWith(token) || part.includes(token)));
  });
}

export function getUniversityRecordsForCountry(countryCode) {
  const code = resolveCountryCode(countryCode);
  const byCountry = UNIVERSITIES_BY_LOCATION[code] || {};
  return Object.entries(byCountry).flatMap(([city, universities]) =>
    (universities || []).map((name) => ({
      countryCode: code,
      city,
      name,
      aliases: UNIVERSITY_ALIASES[name] || [],
      searchText: universitySearchTokens(name).join(" "),
    }))
  );
}

export function searchUniversitiesForCountry(countryCode, query = "", selectedCity = "") {
  const code = resolveCountryCode(countryCode);
  const cityName = String(selectedCity || "").trim();
  const cityOrder = getCitiesForCountry(code);
  const records = getUniversityRecordsForCountry(code)
    .filter((record) => matchesUniversityQuery(record.name, query))
    .sort((a, b) => {
      const aSelected = cityName && a.city.toLocaleLowerCase("tr-TR") === cityName.toLocaleLowerCase("tr-TR");
      const bSelected = cityName && b.city.toLocaleLowerCase("tr-TR") === cityName.toLocaleLowerCase("tr-TR");
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      const cityDelta = cityOrder.indexOf(a.city) - cityOrder.indexOf(b.city);
      if (cityDelta !== 0) return cityDelta;
      return a.name.localeCompare(b.name, "tr");
    });
  return records;
}

export function auditUniversityCatalog() {
  const duplicateEntries = [];
  const invalidMappings = [];
  const missingAliases = [];
  for (const [countryCode, cities] of Object.entries(UNIVERSITIES_BY_LOCATION)) {
    const cityCatalog = getCitiesForCountry(countryCode).map((city) => normalizeSearchText(city));
    const seen = new Map();
    for (const [city, universities] of Object.entries(cities)) {
      if (!cityCatalog.includes(normalizeSearchText(city))) {
        invalidMappings.push({ countryCode, city, reason: "city_not_in_country_catalog" });
      }
      for (const university of universities || []) {
        const key = normalizeSearchText(university);
        if (seen.has(key)) {
          duplicateEntries.push({
            countryCode,
            university,
            firstCity: seen.get(key),
            duplicateCity: city,
          });
        } else {
          seen.set(key, city);
        }
        if (!UNIVERSITY_ALIASES[university]?.length) {
          missingAliases.push({ countryCode, city, university });
        }
      }
    }
  }
  return { duplicateEntries, invalidMappings, missingAliases };
}

export function getCountryLabel(code, lang = "TR") {
  const c = COUNTRIES.find((x) => x.code === normalizeCountryCode(code));
  if (!c) return String(code || "").trim();
  return String(lang || "").toUpperCase() === "TR" ? c.nameTR : c.nameEN;
}

export function normalizeCountryCode(input) {
  return resolveCountryCode(input);
}

export function resolveCountryCode(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  const fromLookup = LOOKUP[s] || LOOKUP[s.toLowerCase()] || LOOKUP[s.toUpperCase()];
  if (fromLookup) return fromLookup;
  const upper = s.toUpperCase();
  if (CODE_SET.has(upper)) return upper;
  return "";
}

/** @deprecated Use resolveCountryCode + getCountryLabel */
export function countryNameToCode(name) {
  return resolveCountryCode(name);
}

/** @deprecated Use getCountryLabel */
export function countryCodeToName(code, lang = "EN") {
  return getCountryLabel(code, lang);
}

/** @deprecated Use resolveCountryCode */
export function normalizeCountryName(name) {
  const code = resolveCountryCode(name);
  return code ? getCountryLabel(code, "EN") : String(name || "").trim();
}

export function filterCountries(query, selectedCodes = [], lang = "TR") {
  const q = String(query || "").trim().toLowerCase();
  const sel = new Set((selectedCodes || []).map((c) => resolveCountryCode(c)).filter(Boolean));
  return COUNTRIES.filter((c) => {
    if (sel.has(c.code)) return false;
    if (!q) return true;
    const label = getCountryLabel(c.code, lang).toLowerCase();
    return (
      label.includes(q) ||
      c.nameEN.toLowerCase().includes(q) ||
      c.nameTR.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });
}

export function hasCityCatalog(countryCode) {
  const code = resolveCountryCode(countryCode);
  const list = CITIES_BY_COUNTRY[code];
  return Array.isArray(list) && list.length > 0;
}

export function getCitiesForCountry(countryCode) {
  const code = resolveCountryCode(countryCode);
  return CITIES_BY_COUNTRY[code] ? [...CITIES_BY_COUNTRY[code]] : [];
}

export function filterCities(countryCode, query) {
  const catalog = getCitiesForCountry(countryCode);
  const q = normalizeSearchText(query);
  if (!catalog.length) return [];
  if (!q) return catalog;
  return catalog.filter((city) => normalizeSearchText(city).includes(q));
}

export function getUniversitiesForLocation(countryCode, city) {
  const code = resolveCountryCode(countryCode);
  const cityName = String(city || "").trim();
  const byCountry = UNIVERSITIES_BY_LOCATION[code] || {};
  const direct = byCountry[cityName];
  if (Array.isArray(direct)) return [...direct];
  const matchKey = Object.keys(byCountry).find((key) => key.toLocaleLowerCase("tr-TR") === cityName.toLocaleLowerCase("tr-TR"));
  return matchKey && Array.isArray(byCountry[matchKey]) ? [...byCountry[matchKey]] : [];
}

export function filterUniversities(countryCode, city, query) {
  const cityCatalog = getUniversitiesForLocation(countryCode, city);
  const q = String(query || "").trim();
  if (!q) return cityCatalog;
  const cityMatches = cityCatalog.filter((name) => matchesUniversityQuery(name, q));
  if (cityMatches.length) return cityMatches;
  return searchUniversitiesForCountry(countryCode, q, city).map((record) => record.name);
}

export function isUniversityInCatalog(countryCode, city, university) {
  const value = String(university || "").trim().toLocaleLowerCase("tr-TR");
  if (!value) return false;
  return getUniversitiesForLocation(countryCode, city).some((name) => name.toLocaleLowerCase("tr-TR") === value);
}

export function getCityGroupsForCountries(countryCodes = [], lang = "TR") {
  return (countryCodes || [])
    .map((raw) => {
      const code = resolveCountryCode(raw);
      if (!code) return null;
      return {
        code,
        country: getCountryLabel(code, lang),
        cities: getCitiesForCountry(code),
        hasCatalog: hasCityCatalog(code),
      };
    })
    .filter(Boolean);
}

export function isResidenceCityRequired(countryCode) {
  return RESIDENCE_CITY_REQUIRED_CODES.includes(resolveCountryCode(countryCode));
}

/** Legacy: flat EN name list */
export const COUNTRY_NAMES = COUNTRIES.map((c) => c.nameEN);

