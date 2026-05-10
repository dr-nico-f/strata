// Modern majority religion per country (year >= 1945).
//
// Source: Pew Research Center, "Global Religious Landscape" (2010 baseline,
// 2020 update) + Pew "Religious Composition by Country, 2010-2050".
//   https://www.pewresearch.org/religion/feature/global-religious-landscape/
//   https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2050/
//
// Country keys match the `NAME` property in the boundary GeoJSONs sourced from
// `aourednik/historical-basemaps` (which uses Natural Earth-derived names).
//
// Religion ids match the historical schematic ids in religions.ts. An extra
// "unaffiliated" id covers the six countries Pew identifies as having a
// religiously unaffiliated majority (China, Czech Republic, Estonia, North
// Korea, Hong Kong, Japan).
//
// `confidence` is "majority" (>50% adherence) or "plurality" (largest single
// religion but <50%). Plurality countries are still rendered but at a softer
// fill opacity in the layer.

export type ModernReligionId =
  | "christianity"
  | "islam"
  | "buddhism"
  | "hinduism"
  | "judaism"
  | "chinese-traditions"
  | "unaffiliated";

export interface ModernReligionEntry {
  /** Country `NAME` as it appears in the boundary GeoJSONs. */
  name: string;
  religion: ModernReligionId;
  /** "majority" = >50%, "plurality" = largest group <50%. */
  confidence: "majority" | "plurality";
}

export const MODERN_RELIGION_BY_COUNTRY: readonly ModernReligionEntry[] = [
  // -------- Christianity (157 countries with Christian majority per Pew) --
  // Europe (excl. Albania, Bosnia, Kosovo, Turkey)
  { name: "United Kingdom", religion: "christianity", confidence: "majority" },
  { name: "France", religion: "christianity", confidence: "majority" },
  { name: "Germany", religion: "christianity", confidence: "majority" },
  { name: "Italy", religion: "christianity", confidence: "majority" },
  { name: "Spain", religion: "christianity", confidence: "majority" },
  { name: "Portugal", religion: "christianity", confidence: "majority" },
  { name: "Ireland", religion: "christianity", confidence: "majority" },
  { name: "Netherlands", religion: "christianity", confidence: "plurality" },
  { name: "Belgium", religion: "christianity", confidence: "majority" },
  { name: "Luxembourg", religion: "christianity", confidence: "majority" },
  { name: "Switzerland", religion: "christianity", confidence: "majority" },
  { name: "Austria", religion: "christianity", confidence: "majority" },
  { name: "Denmark", religion: "christianity", confidence: "majority" },
  { name: "Sweden", religion: "christianity", confidence: "majority" },
  { name: "Norway", religion: "christianity", confidence: "majority" },
  { name: "Finland", religion: "christianity", confidence: "majority" },
  { name: "Iceland", religion: "christianity", confidence: "majority" },
  { name: "Poland", religion: "christianity", confidence: "majority" },
  { name: "Hungary", religion: "christianity", confidence: "majority" },
  { name: "Romania", religion: "christianity", confidence: "majority" },
  { name: "Bulgaria", religion: "christianity", confidence: "majority" },
  { name: "Slovakia", religion: "christianity", confidence: "majority" },
  { name: "Slovenia", religion: "christianity", confidence: "majority" },
  { name: "Croatia", religion: "christianity", confidence: "majority" },
  { name: "Serbia", religion: "christianity", confidence: "majority" },
  { name: "Montenegro", religion: "christianity", confidence: "majority" },
  { name: "Macedonia", religion: "christianity", confidence: "majority" },
  { name: "North Macedonia", religion: "christianity", confidence: "majority" },
  { name: "Greece", religion: "christianity", confidence: "majority" },
  { name: "Cyprus", religion: "christianity", confidence: "majority" },
  { name: "Malta", religion: "christianity", confidence: "majority" },
  { name: "Russia", religion: "christianity", confidence: "majority" },
  { name: "Ukraine", religion: "christianity", confidence: "majority" },
  { name: "Belarus", religion: "christianity", confidence: "majority" },
  { name: "Moldova", religion: "christianity", confidence: "majority" },
  { name: "Georgia", religion: "christianity", confidence: "majority" },
  { name: "Armenia", religion: "christianity", confidence: "majority" },
  { name: "Latvia", religion: "christianity", confidence: "majority" },
  { name: "Lithuania", religion: "christianity", confidence: "majority" },

  // Americas (almost entirely Christian)
  { name: "United States", religion: "christianity", confidence: "majority" },
  {
    name: "United States of America",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "Canada", religion: "christianity", confidence: "majority" },
  { name: "Mexico", religion: "christianity", confidence: "majority" },
  { name: "Guatemala", religion: "christianity", confidence: "majority" },
  { name: "Honduras", religion: "christianity", confidence: "majority" },
  { name: "El Salvador", religion: "christianity", confidence: "majority" },
  { name: "Nicaragua", religion: "christianity", confidence: "majority" },
  { name: "Costa Rica", religion: "christianity", confidence: "majority" },
  { name: "Panama", religion: "christianity", confidence: "majority" },
  { name: "Cuba", religion: "christianity", confidence: "majority" },
  {
    name: "Dominican Republic",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "Haiti", religion: "christianity", confidence: "majority" },
  { name: "Jamaica", religion: "christianity", confidence: "majority" },
  { name: "Puerto Rico", religion: "christianity", confidence: "majority" },
  { name: "Bahamas", religion: "christianity", confidence: "majority" },
  {
    name: "Trinidad and Tobago",
    religion: "christianity",
    confidence: "plurality",
  },
  { name: "Brazil", religion: "christianity", confidence: "majority" },
  { name: "Argentina", religion: "christianity", confidence: "majority" },
  { name: "Chile", religion: "christianity", confidence: "majority" },
  { name: "Peru", religion: "christianity", confidence: "majority" },
  { name: "Colombia", religion: "christianity", confidence: "majority" },
  { name: "Venezuela", religion: "christianity", confidence: "majority" },
  { name: "Ecuador", religion: "christianity", confidence: "majority" },
  { name: "Bolivia", religion: "christianity", confidence: "majority" },
  { name: "Paraguay", religion: "christianity", confidence: "majority" },
  { name: "Uruguay", religion: "christianity", confidence: "majority" },
  { name: "Guyana", religion: "christianity", confidence: "plurality" },
  { name: "Suriname", religion: "christianity", confidence: "plurality" },

  // Sub-Saharan Africa (Christian-majority countries)
  { name: "South Africa", religion: "christianity", confidence: "majority" },
  { name: "Kenya", religion: "christianity", confidence: "majority" },
  { name: "Uganda", religion: "christianity", confidence: "majority" },
  { name: "Tanzania", religion: "christianity", confidence: "plurality" },
  { name: "Ethiopia", religion: "christianity", confidence: "majority" },
  { name: "Rwanda", religion: "christianity", confidence: "majority" },
  { name: "Burundi", religion: "christianity", confidence: "majority" },
  {
    name: "Democratic Republic of the Congo",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "Congo", religion: "christianity", confidence: "majority" },
  {
    name: "Republic of Congo",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "Angola", religion: "christianity", confidence: "majority" },
  { name: "Zambia", religion: "christianity", confidence: "majority" },
  { name: "Zimbabwe", religion: "christianity", confidence: "majority" },
  { name: "Malawi", religion: "christianity", confidence: "majority" },
  { name: "Mozambique", religion: "christianity", confidence: "plurality" },
  { name: "Madagascar", religion: "christianity", confidence: "plurality" },
  { name: "Cameroon", religion: "christianity", confidence: "majority" },
  { name: "Ghana", religion: "christianity", confidence: "majority" },
  { name: "Liberia", religion: "christianity", confidence: "majority" },
  { name: "Botswana", religion: "christianity", confidence: "majority" },
  { name: "Namibia", religion: "christianity", confidence: "majority" },
  { name: "Lesotho", religion: "christianity", confidence: "majority" },
  { name: "Swaziland", religion: "christianity", confidence: "majority" },
  { name: "Eswatini", religion: "christianity", confidence: "majority" },
  { name: "Gabon", religion: "christianity", confidence: "majority" },
  {
    name: "Equatorial Guinea",
    religion: "christianity",
    confidence: "majority",
  },
  {
    name: "São Tomé and Príncipe",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "Cape Verde", religion: "christianity", confidence: "majority" },
  { name: "Cabo Verde", religion: "christianity", confidence: "majority" },
  {
    name: "Central African Republic",
    religion: "christianity",
    confidence: "majority",
  },
  { name: "South Sudan", religion: "christianity", confidence: "majority" },
  { name: "Eritrea", religion: "christianity", confidence: "plurality" },
  {
    name: "Ivory Coast",
    religion: "christianity",
    confidence: "plurality",
  },
  { name: "Côte d'Ivoire", religion: "christianity", confidence: "plurality" },

  // Oceania (mostly Christian)
  { name: "Australia", religion: "christianity", confidence: "majority" },
  { name: "New Zealand", religion: "christianity", confidence: "plurality" },
  { name: "Papua New Guinea", religion: "christianity", confidence: "majority" },
  { name: "Fiji", religion: "christianity", confidence: "majority" },
  { name: "Solomon Islands", religion: "christianity", confidence: "majority" },
  { name: "Vanuatu", religion: "christianity", confidence: "majority" },
  { name: "Samoa", religion: "christianity", confidence: "majority" },
  { name: "Tonga", religion: "christianity", confidence: "majority" },
  { name: "Kiribati", religion: "christianity", confidence: "majority" },
  { name: "Marshall Islands", religion: "christianity", confidence: "majority" },
  { name: "Micronesia", religion: "christianity", confidence: "majority" },
  { name: "Palau", religion: "christianity", confidence: "majority" },
  { name: "Tuvalu", religion: "christianity", confidence: "majority" },
  { name: "Nauru", religion: "christianity", confidence: "majority" },

  // Christian-majority outliers in Asia
  { name: "Philippines", religion: "christianity", confidence: "majority" },
  { name: "Timor-Leste", religion: "christianity", confidence: "majority" },
  { name: "East Timor", religion: "christianity", confidence: "majority" },

  // -------- Islam (49 countries with Muslim majority per Pew) --
  // Middle East
  { name: "Saudi Arabia", religion: "islam", confidence: "majority" },
  { name: "Iran", religion: "islam", confidence: "majority" },
  { name: "Iraq", religion: "islam", confidence: "majority" },
  { name: "Syria", religion: "islam", confidence: "majority" },
  { name: "Jordan", religion: "islam", confidence: "majority" },
  { name: "Lebanon", religion: "islam", confidence: "plurality" },
  { name: "Palestine", religion: "islam", confidence: "majority" },
  { name: "Yemen", religion: "islam", confidence: "majority" },
  { name: "Oman", religion: "islam", confidence: "majority" },
  { name: "Qatar", religion: "islam", confidence: "majority" },
  { name: "Kuwait", religion: "islam", confidence: "majority" },
  { name: "Bahrain", religion: "islam", confidence: "majority" },
  {
    name: "United Arab Emirates",
    religion: "islam",
    confidence: "majority",
  },
  { name: "Turkey", religion: "islam", confidence: "majority" },
  // North Africa
  { name: "Egypt", religion: "islam", confidence: "majority" },
  { name: "Libya", religion: "islam", confidence: "majority" },
  { name: "Tunisia", religion: "islam", confidence: "majority" },
  { name: "Algeria", religion: "islam", confidence: "majority" },
  { name: "Morocco", religion: "islam", confidence: "majority" },
  { name: "Western Sahara", religion: "islam", confidence: "majority" },
  { name: "Sudan", religion: "islam", confidence: "majority" },
  { name: "Mauritania", religion: "islam", confidence: "majority" },
  // Sub-Saharan Muslim
  { name: "Senegal", religion: "islam", confidence: "majority" },
  { name: "Mali", religion: "islam", confidence: "majority" },
  { name: "Niger", religion: "islam", confidence: "majority" },
  { name: "Chad", religion: "islam", confidence: "majority" },
  { name: "Somalia", religion: "islam", confidence: "majority" },
  { name: "Djibouti", religion: "islam", confidence: "majority" },
  { name: "Comoros", religion: "islam", confidence: "majority" },
  { name: "Gambia", religion: "islam", confidence: "majority" },
  {
    name: "The Gambia",
    religion: "islam",
    confidence: "majority",
  },
  { name: "Sierra Leone", religion: "islam", confidence: "majority" },
  { name: "Burkina Faso", religion: "islam", confidence: "majority" },
  { name: "Guinea", religion: "islam", confidence: "majority" },
  { name: "Guinea-Bissau", religion: "islam", confidence: "plurality" },
  {
    name: "Nigeria",
    religion: "islam",
    confidence: "plurality",
  },
  // Central / South / SE Asia Muslim
  { name: "Pakistan", religion: "islam", confidence: "majority" },
  { name: "Afghanistan", religion: "islam", confidence: "majority" },
  { name: "Bangladesh", religion: "islam", confidence: "majority" },
  { name: "Maldives", religion: "islam", confidence: "majority" },
  { name: "Indonesia", religion: "islam", confidence: "majority" },
  { name: "Malaysia", religion: "islam", confidence: "majority" },
  { name: "Brunei", religion: "islam", confidence: "majority" },
  { name: "Kazakhstan", religion: "islam", confidence: "majority" },
  { name: "Uzbekistan", religion: "islam", confidence: "majority" },
  { name: "Turkmenistan", religion: "islam", confidence: "majority" },
  { name: "Tajikistan", religion: "islam", confidence: "majority" },
  { name: "Kyrgyzstan", religion: "islam", confidence: "majority" },
  { name: "Azerbaijan", religion: "islam", confidence: "majority" },
  // Balkans Muslim
  { name: "Albania", religion: "islam", confidence: "majority" },
  { name: "Kosovo", religion: "islam", confidence: "majority" },
  {
    name: "Bosnia and Herzegovina",
    religion: "islam",
    confidence: "plurality",
  },

  // -------- Hinduism (3 countries Hindu-majority per Pew) --
  { name: "India", religion: "hinduism", confidence: "majority" },
  { name: "Nepal", religion: "hinduism", confidence: "majority" },
  { name: "Mauritius", religion: "hinduism", confidence: "majority" },

  // -------- Buddhism (7 countries Buddhist-majority per Pew) --
  { name: "Thailand", religion: "buddhism", confidence: "majority" },
  { name: "Cambodia", religion: "buddhism", confidence: "majority" },
  { name: "Myanmar", religion: "buddhism", confidence: "majority" },
  { name: "Burma", religion: "buddhism", confidence: "majority" },
  { name: "Sri Lanka", religion: "buddhism", confidence: "majority" },
  { name: "Laos", religion: "buddhism", confidence: "majority" },
  { name: "Bhutan", religion: "buddhism", confidence: "majority" },
  { name: "Mongolia", religion: "buddhism", confidence: "majority" },
  { name: "Singapore", religion: "buddhism", confidence: "plurality" },
  { name: "Taiwan", religion: "buddhism", confidence: "plurality" },
  { name: "South Korea", religion: "buddhism", confidence: "plurality" },

  // -------- Judaism (1 country Jewish-majority per Pew) --
  { name: "Israel", religion: "judaism", confidence: "majority" },

  // -------- Chinese / East Asian traditions ---------------
  // (Pew classifies many of these as "unaffiliated" because of how respondents
  // self-identify, but Confucian / Taoist / folk traditions remain culturally
  // dominant. Use plurality so the fill is softer than the strict majorities.)
  { name: "Vietnam", religion: "chinese-traditions", confidence: "plurality" },

  // -------- Unaffiliated-majority (6 countries per Pew 2010) --
  { name: "China", religion: "unaffiliated", confidence: "majority" },
  { name: "North Korea", religion: "unaffiliated", confidence: "majority" },
  { name: "Czech Republic", religion: "unaffiliated", confidence: "majority" },
  { name: "Czechia", religion: "unaffiliated", confidence: "majority" },
  { name: "Estonia", religion: "unaffiliated", confidence: "plurality" },
  { name: "Hong Kong", religion: "unaffiliated", confidence: "plurality" },
  { name: "Japan", religion: "unaffiliated", confidence: "plurality" },
];

/** Color palette mirrors religions.ts for consistency. */
export const MODERN_RELIGION_COLOR: Record<ModernReligionId, string> = {
  christianity: "#7aa2ff",
  islam: "#5fd1a0",
  buddhism: "#ffd86b",
  hinduism: "#ff8a8a",
  judaism: "#3da9c7",
  "chinese-traditions": "#c19be0",
  unaffiliated: "#888a93",
};

export const MODERN_RELIGION_LABEL: Record<ModernReligionId, string> = {
  christianity: "Christianity",
  islam: "Islam",
  buddhism: "Buddhism",
  hinduism: "Hinduism",
  judaism: "Judaism",
  "chinese-traditions": "Chinese / East Asian traditions",
  unaffiliated: "Religiously unaffiliated",
};

/** Earliest year the country-fill mode is meaningful (Pew baseline era). */
export const MODERN_RELIGION_MIN_YEAR = 1945;
