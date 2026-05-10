import type { LayerId } from "../store";

/**
 * A single beat in a story tour. The runtime applies these properties
 * imperatively when the chapter is entered:
 *   - setYear(year)
 *   - flyTo(center, zoom)
 *   - setLocked({ layer: pinLayer, name: title, detail: narration, lng/lat: pinAt, ... })
 *   - delta-merge enableLayers / disableLayers into the layer toggles
 *
 * Narration is the user-facing prose shown in the StoryPlayer panel and
 * (truncated) inside the pinned tooltip's `detail` field.
 */
export interface StoryChapter {
  /** Year that should be active when this chapter plays. */
  year: number;
  /** Short, scannable headline. Becomes the pinned tooltip title. */
  title: string;
  /** 1-3 sentence prose. Shown in the StoryPlayer panel. */
  narration: string;
  /** Map camera target. */
  center: [number, number];
  /** Map camera zoom. */
  zoom: number;
  /** Optional pin location override; defaults to `center`. */
  pinAt?: [number, number];
  /** Wikipedia article slug for the "Wikipedia ↗" link in the pin. */
  wikipedia?: string;
  /** Layer badge color in the pinned tooltip. Defaults to "events". */
  pinLayer?: LayerId;
  /** Layers to switch on for this chapter (additive). */
  enableLayers?: LayerId[];
  /** Layers to switch off for this chapter. */
  disableLayers?: LayerId[];
}

export interface Story {
  id: string;
  title: string;
  summary: string;
  /** Loose era bucket used by the picker for grouping. */
  era:
    | "Antiquity"
    | "Classical & Faiths"
    | "Medieval"
    | "Exploration & Reformation"
    | "Revolutions & Empires"
    | "Modern";
  chapters: readonly StoryChapter[];
}

const SHARED_DEFAULTS = {
  enableHumanLayers: ["boundaries", "cities", "events"] as LayerId[],
};

/**
 * 33 curated tours covering ~50 chapters of major world history, designed for
 * the time-slider map. Camera coordinates are tuned for a comfortable framing
 * at the suggested zoom level. Narration is intentionally tight — the panel is
 * a hint, not an essay.
 */
export const STORIES: readonly Story[] = [
  // ------------------------------------------------------------------
  // ANTIQUITY
  // ------------------------------------------------------------------
  {
    id: "first-cities",
    title: "The First Cities",
    summary: "Mesopotamia learns to live behind walls.",
    era: "Antiquity",
    chapters: [
      {
        year: -3500,
        title: "Uruk takes shape",
        narration:
          "On the Euphrates floodplain, Uruk swells past 40,000 — the first city we can recognize as one. Writing, bureaucracy, and city walls all appear here within a few centuries.",
        center: [45.6, 31.3],
        zoom: 5.4,
        pinAt: [45.64, 31.32],
        wikipedia: "Uruk",
        enableLayers: ["cities", "boundaries", "peoples"],
      },
    ],
  },
  {
    id: "great-pyramid",
    title: "The Pyramid Builders",
    summary: "Egypt at the height of the Old Kingdom.",
    era: "Antiquity",
    chapters: [
      {
        year: -2560,
        title: "Khufu finishes his pyramid",
        narration:
          "On the Giza plateau, the largest of the three Great Pyramids — 146 metres of limestone — is completed. Egypt is unified, prosperous, and thoroughly committed to engineering for the afterlife.",
        center: [31.13, 29.98],
        zoom: 6,
        pinAt: [31.134, 29.979],
        wikipedia: "Great_Pyramid_of_Giza",
        enableLayers: ["cities", "boundaries"],
      },
    ],
  },
  {
    id: "hammurabi",
    title: "Hammurabi's Code",
    summary: "Law gets written down on stone, in cuneiform, in Babylon.",
    era: "Antiquity",
    chapters: [
      {
        year: -1754,
        title: "An eye for an eye, in writing",
        narration:
          "King Hammurabi of Babylon issues 282 numbered laws — covering theft, marriage, false witness, malpractice — and has them carved onto a 2.25 m basalt stele. One of the earliest surviving legal codes.",
        center: [44.4, 32.5],
        zoom: 5.5,
        pinAt: [44.42, 32.54],
        wikipedia: "Code_of_Hammurabi",
        enableLayers: ["cities", "boundaries", "events"],
      },
    ],
  },
  {
    id: "achaemenid-persia",
    title: "Persia at its Height",
    summary: "The Achaemenid empire stretches from the Indus to the Aegean.",
    era: "Antiquity",
    chapters: [
      {
        year: -500,
        title: "Darius I rules from Persepolis",
        narration:
          "Persepolis becomes the ceremonial capital of the largest empire the ancient world has yet seen — 50 million people, from the Hellespont to the Hindu Kush, connected by the Royal Road.",
        center: [52.9, 29.9],
        zoom: 4.6,
        pinAt: [52.89, 29.94],
        wikipedia: "Persepolis",
        enableLayers: ["boundaries", "cities", "connections"],
      },
    ],
  },
  {
    id: "athens-zenith",
    title: "Athens at Zenith",
    summary: "Pericles, the Parthenon, and the brief golden age before war.",
    era: "Antiquity",
    chapters: [
      {
        year: -432,
        title: "The Parthenon is finished",
        narration:
          "Athens, fresh from leading Greece against Persia, finishes the Parthenon on the Acropolis. Within a year the Peloponnesian War begins; the city's fortunes never quite recover.",
        center: [23.73, 37.97],
        zoom: 6,
        pinAt: [23.726, 37.971],
        wikipedia: "Parthenon",
        enableLayers: ["cities", "boundaries"],
      },
    ],
  },
  {
    id: "alexander",
    title: "Alexander's Whirlwind",
    summary: "From Macedon to the Indus in twelve years.",
    era: "Antiquity",
    chapters: [
      {
        year: -334,
        title: "Crossing into Asia",
        narration:
          "At twenty-two, Alexander leads 40,000 Macedonians and Greeks across the Hellespont. Within months he routs the Persian satraps at the Granicus.",
        center: [27, 40.5],
        zoom: 5,
        pinAt: [27.1, 40.4],
        wikipedia: "Battle_of_the_Granicus",
        enableLayers: ["boundaries", "battles", "cities"],
      },
      {
        year: -331,
        title: "Gaugamela ends Persia",
        narration:
          "On the plain of Gaugamela, Alexander shatters Darius III's army of perhaps 100,000. The Achaemenid empire — two centuries old — falls within the year.",
        center: [43.2, 36.4],
        zoom: 5,
        pinAt: [43.2, 36.4],
        wikipedia: "Battle_of_Gaugamela",
      },
      {
        year: -330,
        title: "Persepolis burns",
        narration:
          "Alexander takes Persepolis, makes off with its treasury, and — drunk, or as a calculated act of revenge for the burning of Athens — sets the palaces alight.",
        center: [52.9, 29.9],
        zoom: 5.5,
        pinAt: [52.89, 29.94],
        wikipedia: "Persepolis",
      },
      {
        year: -326,
        title: "At the Hyphasis, the army turns back",
        narration:
          "Alexander reaches the Beas in the Punjab. His exhausted soldiers, eight years from home, refuse to march further east. He turns south down the Indus, and dies in Babylon at 32.",
        center: [75.5, 31.5],
        zoom: 4.6,
        pinAt: [75.5, 31.5],
        wikipedia: "Mutiny_at_the_Hyphasis",
      },
    ],
  },
  {
    id: "qin-china",
    title: "Qin Unifies China",
    summary: "The First Emperor invents China — and a wall.",
    era: "Antiquity",
    chapters: [
      {
        year: -221,
        title: "Qin Shi Huang takes the throne",
        narration:
          "Having conquered the last of the Warring States, Qin Shi Huang declares himself First Emperor. Standardised script, weights, axles, and a vast new wall along the steppe frontier follow.",
        center: [108.9, 34.3],
        zoom: 4.5,
        pinAt: [108.95, 34.27],
        wikipedia: "Qin_Shi_Huang",
        enableLayers: ["boundaries", "cities", "events"],
      },
    ],
  },
  {
    id: "rubicon",
    title: "Caesar Crosses the Rubicon",
    summary: "A small river. A republic ends.",
    era: "Antiquity",
    chapters: [
      {
        year: -49,
        title: "Alea iacta est",
        narration:
          "Caesar, refused a second consulship, leads a single legion across the Rubicon — the legal northern boundary of Italy. \"The die is cast.\" Rome's civil wars begin; the Republic does not survive them.",
        center: [12.5, 44.0],
        zoom: 5.5,
        pinAt: [12.4, 44.1],
        wikipedia: "Crossing_of_the_Rubicon",
        enableLayers: ["boundaries", "events", "people"],
      },
    ],
  },
  {
    id: "han-dynasty",
    title: "Han Dynasty's Reach",
    summary: "Chang'an, the Silk Road, and a state to rival Rome.",
    era: "Classical & Faiths",
    chapters: [
      {
        year: 100,
        title: "Chang'an at 400,000",
        narration:
          "The Han capital is one of the largest cities on Earth. Trade caravans link it to Rome via Sogdian middlemen; Buddhist monks begin to arrive from India.",
        center: [108.9, 34.3],
        zoom: 4,
        pinAt: [108.94, 34.34],
        wikipedia: "Chang'an",
        enableLayers: ["boundaries", "cities", "connections"],
      },
    ],
  },

  // ------------------------------------------------------------------
  // CLASSICAL WORLD & FAITHS
  // ------------------------------------------------------------------
  {
    id: "christianity",
    title: "Birth of Christianity",
    summary: "From a Galilean execution to the religion of Rome.",
    era: "Classical & Faiths",
    chapters: [
      {
        year: 33,
        title: "Crucifixion in Jerusalem",
        narration:
          "Jesus of Nazareth is crucified outside Jerusalem under the prefect Pontius Pilate. His followers begin to spread the new faith through the Greek-speaking cities of the eastern Mediterranean.",
        center: [35.23, 31.78],
        zoom: 5.5,
        pinAt: [35.23, 31.78],
        wikipedia: "Crucifixion_of_Jesus",
        enableLayers: ["boundaries", "religions", "cities"],
      },
      {
        year: 64,
        title: "Persecution under Nero",
        narration:
          "After the great fire, Nero blames the Christians of Rome and executes many — among them, by tradition, Peter and Paul. The faith is now firmly Roman, urban, and dangerous to belong to.",
        center: [12.5, 41.9],
        zoom: 5.2,
        pinAt: [12.5, 41.9],
        wikipedia: "Great_Fire_of_Rome",
      },
      {
        year: 313,
        title: "Edict of Milan",
        narration:
          "Constantine and Licinius legalise Christianity across the empire. Within a generation, it becomes the dominant religion of the Mediterranean.",
        center: [9.2, 45.5],
        zoom: 4.6,
        pinAt: [9.2, 45.46],
        wikipedia: "Edict_of_Milan",
      },
    ],
  },
  {
    id: "hijra-islam",
    title: "Hijra & the Rise of Islam",
    summary: "From a flight by night to a caliphate spanning three continents.",
    era: "Classical & Faiths",
    chapters: [
      {
        year: 622,
        title: "The Hijra",
        narration:
          "Persecuted in Mecca, Muhammad and his followers move to Yathrib — soon to be called Medina. The Islamic calendar begins from this year.",
        center: [39.6, 24.5],
        zoom: 5.5,
        pinAt: [39.6, 24.47],
        wikipedia: "Hijrah",
        enableLayers: ["boundaries", "religions", "cities"],
      },
      {
        year: 661,
        title: "The Umayyads from Damascus",
        narration:
          "Within thirty years of the Prophet's death, the caliphate moves to Damascus and rules from the Atlantic to the Indus. Arabic becomes the language of administration from Córdoba to Samarkand.",
        center: [36.3, 33.5],
        zoom: 4.5,
        pinAt: [36.3, 33.5],
        wikipedia: "Umayyad_Caliphate",
      },
      {
        year: 732,
        title: "The Tide turns at Tours",
        narration:
          "Charles Martel halts Umayyad raiders deep inside Frankish Gaul. The frontier of Muslim Europe never extends much past the Pyrenees again.",
        center: [0.7, 46.0],
        zoom: 5,
        pinAt: [0.69, 46.7],
        wikipedia: "Battle_of_Tours",
      },
      {
        year: 800,
        title: "Córdoba glitters",
        narration:
          "Under the Umayyads of al-Andalus, Córdoba becomes one of the most populous and learned cities in Europe — paved streets, public baths, a library said to hold 400,000 volumes.",
        center: [-4.8, 37.9],
        zoom: 5,
        pinAt: [-4.78, 37.88],
        wikipedia: "Caliphate_of_C%C3%B3rdoba",
      },
    ],
  },
  {
    id: "vikings",
    title: "Vikings Strike Lindisfarne",
    summary: "An English monastery is the first to learn what longships mean.",
    era: "Classical & Faiths",
    chapters: [
      {
        year: 793,
        title: "Heathen men ravage God's church",
        narration:
          "On 8 June, raiders from Norway sack the wealthy monastery on Lindisfarne. The Anglo-Saxon Chronicle records: \"the harrying of heathen men miserably destroyed God's church.\" The Viking Age has begun.",
        center: [-1.8, 55.7],
        zoom: 6,
        pinAt: [-1.8, 55.68],
        wikipedia: "Lindisfarne",
        enableLayers: ["boundaries", "events", "cities"],
      },
    ],
  },
  {
    id: "charlemagne",
    title: "Charlemagne Crowned Emperor",
    summary: "On Christmas Day in Rome, Europe gets a Western emperor again.",
    era: "Classical & Faiths",
    chapters: [
      {
        year: 800,
        title: "Pope Leo III crowns him in St Peter's",
        narration:
          "Charlemagne is crowned Imperator Romanorum by the Pope — three centuries after the last Western emperor was deposed. His Frankish realm covers most of western and central continental Europe.",
        center: [12.45, 41.9],
        zoom: 5,
        pinAt: [12.45, 41.9],
        wikipedia: "Charlemagne",
        enableLayers: ["boundaries", "events", "people"],
      },
    ],
  },

  // ------------------------------------------------------------------
  // MEDIEVAL
  // ------------------------------------------------------------------
  {
    id: "norman-conquest",
    title: "Norman Conquest",
    summary: "1066, and an arrow at Hastings that rewrote England.",
    era: "Medieval",
    chapters: [
      {
        year: 1066,
        title: "King Harold falls at Hastings",
        narration:
          "William of Normandy crosses the Channel and meets Harold Godwinson on Senlac Hill. Harold is killed; within months William is crowned in Westminster. English elites are systematically replaced.",
        center: [0.5, 50.9],
        zoom: 6,
        pinAt: [0.49, 50.91],
        wikipedia: "Battle_of_Hastings",
        enableLayers: ["boundaries", "battles", "cities"],
      },
    ],
  },
  {
    id: "first-crusade",
    title: "First Crusade",
    summary: "Pope Urban II calls for war; four years later, Jerusalem falls.",
    era: "Medieval",
    chapters: [
      {
        year: 1099,
        title: "Crusaders take Jerusalem",
        narration:
          "After a five-week siege, the First Crusade storms Jerusalem and massacres much of its Jewish and Muslim population. The crusader states will hold portions of the Levant for nearly two centuries.",
        center: [35.23, 31.78],
        zoom: 5,
        pinAt: [35.23, 31.78],
        wikipedia: "Siege_of_Jerusalem_(1099)",
        enableLayers: ["boundaries", "battles", "religions"],
      },
    ],
  },
  {
    id: "magna-carta",
    title: "Magna Carta",
    summary: "A bad king is forced to sign at Runnymede.",
    era: "Medieval",
    chapters: [
      {
        year: 1215,
        title: "King John seals the charter",
        narration:
          "Cornered by his rebellious barons, King John seals Magna Carta in a Thames-side meadow. Its core principle — that the king is not above the law — outlives every clause.",
        center: [-0.55, 51.43],
        zoom: 6,
        pinAt: [-0.553, 51.434],
        wikipedia: "Magna_Carta",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },
  {
    id: "polynesians-aotearoa",
    title: "Polynesians Reach Aotearoa",
    summary: "The last great wave of Pacific voyaging closes a 3,000-mile gap.",
    era: "Medieval",
    chapters: [
      {
        year: 1280,
        title: "Waka land in Aotearoa",
        narration:
          "Polynesian navigators sailing from Eastern Polynesia reach New Zealand — the last large landmass settled by humans. They become the Māori; their genealogies still trace back to specific founding canoes.",
        center: [174, -41],
        zoom: 4.4,
        pinAt: [174, -41],
        wikipedia: "M%C4%81ori_history",
        enableLayers: ["cities", "boundaries", "migrations"],
      },
    ],
  },
  {
    id: "mongols",
    title: "Mongol Whirlwind",
    summary: "Nomads on horseback assemble the largest contiguous empire ever.",
    era: "Medieval",
    chapters: [
      {
        year: 1206,
        title: "Genghis Khan unites the steppe",
        narration:
          "Temüjin defeats his last rivals and is acclaimed Genghis Khan at a great kurultai on the Onon. Within twenty years his armies are at the gates of Kiev, Beijing, and Samarkand.",
        center: [108, 47],
        zoom: 4,
        pinAt: [109, 49],
        wikipedia: "Genghis_Khan",
        enableLayers: ["boundaries", "battles", "people"],
      },
      {
        year: 1227,
        title: "Genghis dies; his sons divide Asia",
        narration:
          "After conquering Khwarezm and northern China, Genghis dies on campaign. His sons split the empire into the Golden Horde, the Ilkhanate, the Chagatai khanate, and the Yuan.",
        center: [110, 40],
        zoom: 3.6,
        pinAt: [105, 40],
        wikipedia: "Mongol_Empire",
      },
      {
        year: 1258,
        title: "Sack of Baghdad",
        narration:
          "Hulagu Khan takes Baghdad after a 13-day siege, executes the last Abbasid caliph, and reportedly throws so many books from the libraries into the Tigris that it runs black with ink.",
        center: [44.4, 33.3],
        zoom: 5,
        pinAt: [44.4, 33.3],
        wikipedia: "Siege_of_Baghdad_(1258)",
      },
      {
        year: 1260,
        title: "Stopped at Ain Jalut",
        narration:
          "Mamluk Egypt halts the Mongol advance into the Levant at the Battle of Ain Jalut — the first major defeat the Mongols have suffered.",
        center: [35.4, 32.5],
        zoom: 5,
        pinAt: [35.36, 32.55],
        wikipedia: "Battle_of_Ain_Jalut",
      },
    ],
  },
  {
    id: "black-death",
    title: "Black Death",
    summary: "A flea, a rat, a ship — and a third of Europe.",
    era: "Medieval",
    chapters: [
      {
        year: 1347,
        title: "Plague reaches Caffa",
        narration:
          "Mongol besiegers of the Genoese trading post of Caffa catapult plague-dead bodies over the walls. Genoese galleys flee — and carry Yersinia pestis with them.",
        center: [35.4, 45.0],
        zoom: 4.5,
        pinAt: [35.37, 45.04],
        wikipedia: "Siege_of_Caffa",
        enableLayers: ["boundaries", "disasters", "cities"],
      },
      {
        year: 1348,
        title: "Italy collapses",
        narration:
          "Within a year, Genoa, Venice, Florence, and Pisa lose between a third and a half of their populations. The Decameron is written in the hills above Florence as the city dies.",
        center: [12, 43],
        zoom: 5,
        pinAt: [11.25, 43.77],
        wikipedia: "Black_Death",
      },
      {
        year: 1349,
        title: "Paris and London fall",
        narration:
          "The plague reaches northern Europe. Paris empties; London buries dead in pits at Smithfield. Whole monasteries die together.",
        center: [0, 50],
        zoom: 4.5,
        pinAt: [-0.13, 51.51],
        wikipedia: "Black_Death",
      },
      {
        year: 1353,
        title: "Europe counts the dead",
        narration:
          "Six years on, the worst pandemic in European history has killed perhaps 25 million people — between 30% and 60% of the population. Wages spike. Serfdom strains. The Renaissance is closer than it looks.",
        center: [10, 48],
        zoom: 3.5,
        pinAt: [10, 48],
        wikipedia: "Black_Death",
      },
    ],
  },
  {
    id: "constantinople-falls",
    title: "Fall of Constantinople",
    summary: "After 1,123 years, the walls of Theodosius finally break.",
    era: "Medieval",
    chapters: [
      {
        year: 1453,
        title: "Mehmed II takes the city",
        narration:
          "Ottoman cannons — the largest yet built — pound the Theodosian walls for 53 days. On 29 May the city falls; Constantine XI dies in the streets. Western Europe will date the end of the Middle Ages from this day.",
        center: [29, 41.0],
        zoom: 5.6,
        pinAt: [28.97, 41.01],
        wikipedia: "Fall_of_Constantinople",
        enableLayers: ["boundaries", "battles", "cities"],
      },
    ],
  },

  // ------------------------------------------------------------------
  // EXPLORATION & REFORMATION
  // ------------------------------------------------------------------
  {
    id: "columbus",
    title: "Columbus Reaches the Americas",
    summary: "A Genoese captain, three small ships, and a Bahamian beach.",
    era: "Exploration & Reformation",
    chapters: [
      {
        year: 1492,
        title: "Landfall at San Salvador",
        narration:
          "After 33 days at sea, the Niña, Pinta, and Santa María sight land in the Bahamas. The Columbian Exchange — disease, crops, animals, slaves, silver — begins immediately and will reshape every continent.",
        center: [-74.5, 24],
        zoom: 4.5,
        pinAt: [-74.5, 24.05],
        wikipedia: "Voyages_of_Christopher_Columbus",
        enableLayers: ["boundaries", "connections", "cities"],
      },
    ],
  },
  {
    id: "luther",
    title: "Luther's 95 Theses",
    summary: "A monk in Saxony nails up an academic complaint. Europe splits.",
    era: "Exploration & Reformation",
    chapters: [
      {
        year: 1517,
        title: "All Saints' Eve in Wittenberg",
        narration:
          "On 31 October, Martin Luther sends — and possibly nails — a list of 95 theses against indulgences to Albrecht of Mainz. Within years, half of Germany breaks with Rome.",
        center: [12.65, 51.87],
        zoom: 6,
        pinAt: [12.64, 51.87],
        wikipedia: "Ninety-five_Theses",
        enableLayers: ["boundaries", "religions", "events"],
      },
    ],
  },
  {
    id: "magellan",
    title: "Magellan Circumnavigates",
    summary: "First voyage all the way around — though Magellan didn't make it.",
    era: "Exploration & Reformation",
    chapters: [
      {
        year: 1519,
        title: "Five ships leave Sanlúcar",
        narration:
          "Ferdinand Magellan sails from Spain with 270 men and five ships, looking for a westerly route to the Spice Islands. Three years later, 18 men in the Victoria will return.",
        center: [-6.4, 36.7],
        zoom: 5,
        pinAt: [-6.35, 36.78],
        wikipedia: "Magellan%E2%80%93Elcano_expedition",
        enableLayers: ["boundaries", "connections", "cities"],
      },
      {
        year: 1521,
        title: "Magellan dies at Mactan",
        narration:
          "Having crossed the Pacific in 99 days — the first Europeans to do so — Magellan intervenes in a chiefly dispute on Mactan and is killed in the surf. The expedition presses on without him.",
        center: [124, 10.3],
        zoom: 5.6,
        pinAt: [123.99, 10.31],
        wikipedia: "Battle_of_Mactan",
      },
      {
        year: 1522,
        title: "The Victoria limps home",
        narration:
          "Juan Sebastián Elcano brings the Victoria back to Sanlúcar — the first ship to circumnavigate the globe. The cargo of cloves more than pays for the voyage.",
        center: [-6.4, 36.7],
        zoom: 5,
        pinAt: [-6.35, 36.78],
        wikipedia: "Magellan%E2%80%93Elcano_expedition",
      },
    ],
  },
  {
    id: "spanish-armada",
    title: "Spanish Armada",
    summary: "The largest fleet ever assembled meets weather and Drake.",
    era: "Exploration & Reformation",
    chapters: [
      {
        year: 1588,
        title: "Fireships at Calais",
        narration:
          "Philip II's 130 ships and 30,000 men aim to overthrow Elizabeth I. English fireships scatter the anchored armada off Calais; storms finish the job around Scotland and Ireland. Less than half the fleet returns.",
        center: [1.85, 50.95],
        zoom: 5.5,
        pinAt: [1.86, 50.95],
        wikipedia: "Spanish_Armada",
        enableLayers: ["boundaries", "battles"],
      },
    ],
  },

  // ------------------------------------------------------------------
  // REVOLUTIONS & EMPIRES
  // ------------------------------------------------------------------
  {
    id: "american-revolution",
    title: "American Revolution",
    summary: "Thirteen colonies declare independence.",
    era: "Revolutions & Empires",
    chapters: [
      {
        year: 1776,
        title: "Independence declared in Philadelphia",
        narration:
          "On 4 July, the Continental Congress adopts Thomas Jefferson's declaration. Seven years of war follow; in 1783 the Treaty of Paris recognises the United States.",
        center: [-75.16, 39.95],
        zoom: 5.5,
        pinAt: [-75.15, 39.95],
        wikipedia: "United_States_Declaration_of_Independence",
        enableLayers: ["boundaries", "events", "battles"],
      },
    ],
  },
  {
    id: "french-revolution",
    title: "French Revolution",
    summary: "The old regime ends in three months and several decades.",
    era: "Revolutions & Empires",
    chapters: [
      {
        year: 1789,
        title: "The Bastille falls",
        narration:
          "On 14 July a Parisian crowd storms the Bastille and frees its seven prisoners. Within months the king summons no more, the church loses its lands, and the calendar itself is up for revision.",
        center: [2.37, 48.85],
        zoom: 6,
        pinAt: [2.37, 48.85],
        wikipedia: "Storming_of_the_Bastille",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },
  {
    id: "waterloo",
    title: "Napoleon at Waterloo",
    summary: "Twenty years of European war end in a Belgian rye field.",
    era: "Revolutions & Empires",
    chapters: [
      {
        year: 1815,
        title: "Wellington and Blücher hold",
        narration:
          "Returned from Elba for a 100-day comeback, Napoleon meets Wellington's Anglo-Allied army south of Brussels. Prussian reinforcements decide the battle. He abdicates four days later and dies on St Helena.",
        center: [4.4, 50.68],
        zoom: 6,
        pinAt: [4.41, 50.68],
        wikipedia: "Battle_of_Waterloo",
        enableLayers: ["boundaries", "battles", "people"],
      },
    ],
  },
  {
    id: "berlin-conference",
    title: "Berlin Conference",
    summary: "Fourteen European powers carve up Africa with rulers and pencils.",
    era: "Revolutions & Empires",
    chapters: [
      {
        year: 1884,
        title: "The Scramble formalised",
        narration:
          "Bismarck convenes the colonial powers to set rules for the partition of Africa. Borders are drawn through ethnic groups, watersheds, and trade systems. By 1914, only Ethiopia and Liberia remain independent.",
        center: [13.4, 52.5],
        zoom: 4,
        pinAt: [13.4, 52.5],
        wikipedia: "Berlin_Conference",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },

  // ------------------------------------------------------------------
  // MODERN
  // ------------------------------------------------------------------
  {
    id: "world-war-1",
    title: "World War I",
    summary: "Industrial war on a continental scale.",
    era: "Modern",
    chapters: [
      {
        year: 1914,
        title: "An assassination in Sarajevo",
        narration:
          "On 28 June, Gavrilo Princip shoots Archduke Franz Ferdinand. Within five weeks, the alliance system has dragged six great powers into war. The trenches will hold for four years.",
        center: [18.4, 43.86],
        zoom: 5.5,
        pinAt: [18.42, 43.86],
        wikipedia: "Assassination_of_Archduke_Franz_Ferdinand",
        enableLayers: ["boundaries", "battles", "events"],
      },
      {
        year: 1916,
        title: "Verdun and the Somme",
        narration:
          "Two of the war's bloodiest battles run side by side. Verdun lasts 303 days; the Somme costs 57,000 British casualties on its first day alone. The myth of decisive offensive war dies in their mud.",
        center: [3, 50],
        zoom: 5.5,
        pinAt: [5.4, 49.2],
        wikipedia: "Battle_of_Verdun",
      },
      {
        year: 1919,
        title: "Treaty of Versailles",
        narration:
          "The victorious Allies impose a peace at Versailles, redraw central Europe, dissolve four empires, and lay reparations on Germany. Many of the borders set here will be contested for the next century.",
        center: [2.12, 48.8],
        zoom: 5,
        pinAt: [2.12, 48.8],
        wikipedia: "Treaty_of_Versailles",
      },
    ],
  },
  {
    id: "russian-revolution",
    title: "Russian Revolution",
    summary: "From the Tsar to Lenin in eight months.",
    era: "Modern",
    chapters: [
      {
        year: 1917,
        title: "October in Petrograd",
        narration:
          "After a March abdication and a chaotic provisional government, Bolshevik Red Guards seize the Winter Palace on the night of 7 November. Civil war follows; Lenin leads a workers' state with global ambitions.",
        center: [30.31, 59.94],
        zoom: 5.5,
        pinAt: [30.31, 59.94],
        wikipedia: "October_Revolution",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },
  {
    id: "world-war-2",
    title: "World War II",
    summary: "The deadliest conflict in human history.",
    era: "Modern",
    chapters: [
      {
        year: 1939,
        title: "Germany invades Poland",
        narration:
          "On 1 September, Wehrmacht panzers cross the Polish border; two days later, Britain and France declare war. By summer 1940, France has fallen and Britain stands alone in Western Europe.",
        center: [21, 52],
        zoom: 4.5,
        pinAt: [21, 52],
        wikipedia: "Invasion_of_Poland",
        enableLayers: ["boundaries", "battles", "events"],
      },
      {
        year: 1941,
        title: "Pearl Harbor brings the US in",
        narration:
          "On 7 December, six Japanese carriers strike the US Pacific Fleet at Oahu. The next day, the United States declares war; Germany declares war on the US three days later. The war is now global.",
        center: [-157.95, 21.36],
        zoom: 5,
        pinAt: [-157.95, 21.36],
        wikipedia: "Attack_on_Pearl_Harbor",
      },
      {
        year: 1943,
        title: "Stalingrad turns the tide",
        narration:
          "After five months of street-by-street fighting, the German 6th Army surrenders in Stalingrad. Two million casualties on both sides. The Wehrmacht will not advance again on the Eastern Front.",
        center: [44.5, 48.7],
        zoom: 5.5,
        pinAt: [44.5, 48.71],
        wikipedia: "Battle_of_Stalingrad",
      },
      {
        year: 1944,
        title: "D-Day landings",
        narration:
          "On 6 June, 156,000 Allied troops cross the Channel onto five Normandy beaches. Within a year, Allied armies are in Berlin from the west and the Red Army is in Berlin from the east.",
        center: [-0.7, 49.4],
        zoom: 5.5,
        pinAt: [-0.7, 49.4],
        wikipedia: "Normandy_landings",
      },
      {
        year: 1945,
        title: "Hiroshima and the war's end",
        narration:
          "On 6 and 9 August, US B-29s drop atomic bombs on Hiroshima and Nagasaki. Japan surrenders on 2 September. Sixty to eighty million people are dead — about 3% of the world's 1940 population.",
        center: [132.45, 34.39],
        zoom: 6,
        pinAt: [132.45, 34.39],
        wikipedia: "Atomic_bombings_of_Hiroshima_and_Nagasaki",
      },
    ],
  },
  {
    id: "apollo-11",
    title: "Apollo 11 Lands",
    summary: "Humans walk on another world for the first time.",
    era: "Modern",
    chapters: [
      {
        year: 1969,
        title: "Tranquility Base, here.",
        narration:
          "On 20 July, Neil Armstrong and Buzz Aldrin land the LM Eagle in the Sea of Tranquility. Six hundred million people watch on television. The space race, born of missile rivalry, briefly produces something everyone agrees is wonderful.",
        center: [-80.65, 28.5],
        zoom: 4.5,
        pinAt: [-80.65, 28.5],
        wikipedia: "Apollo_11",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },
  {
    id: "berlin-wall",
    title: "Berlin Wall Falls",
    summary: "A border guard shrugs; an empire follows.",
    era: "Modern",
    chapters: [
      {
        year: 1989,
        title: "9 November in Berlin",
        narration:
          "An East German official misreads a Politburo decision and announces — live, on television — that travel restrictions are lifted, effective immediately. Crowds at the Wall surge through. Within two years, the Soviet Union is gone.",
        center: [13.38, 52.52],
        zoom: 6.2,
        pinAt: [13.38, 52.52],
        wikipedia: "Fall_of_the_Berlin_Wall",
        enableLayers: ["boundaries", "events"],
      },
    ],
  },
  {
    id: "end-apartheid",
    title: "End of Apartheid",
    summary: "South Africa votes for the first time, all together.",
    era: "Modern",
    chapters: [
      {
        year: 1994,
        title: "Mandela elected president",
        narration:
          "Twenty-seven years after his sentencing on Robben Island, Nelson Mandela is sworn in as the first president of a democratic South Africa. The white-minority National Party that built apartheid joins his cabinet of national unity.",
        center: [28.05, -26.2],
        zoom: 5,
        pinAt: [28.05, -26.2],
        wikipedia: "South_African_general_election,_1994",
        enableLayers: ["boundaries", "events", "people"],
      },
    ],
  },
];

// silence the unused-export lint for the small constants used during authoring
void SHARED_DEFAULTS;

export const STORIES_BY_ERA: Record<Story["era"], Story[]> = STORIES.reduce(
  (acc, s) => {
    (acc[s.era] ??= []).push(s);
    return acc;
  },
  {} as Record<Story["era"], Story[]>,
);

export function findStory(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
