export const DOMAINS = [
  "Soil Health and Nutrient Management",
  "Irrigation and Water Management",
  "Insect - Pest Management",
  "Disease Management",
  "Seed and Variety Selection",
  "Cultural and Crop Management Practices",
  "Organic and Natural Farming",
  "Weed Management",
  "Climate, Weather & Stress Management",
  "Farm Tools & Mechanisation",
  "Post-Harvest Management & Storage",
  "Market Prices, MSP & Marketing",
  "Agricultural Schemes & Subsidies",
  "Credit, Loan & Insurance",
  "Capacity Building & Extension",
  "Rural Infrastructure",
  "Animal Husbandry & Livestock",
  "Fisheries & Aquaculture",
  "Allied Agricultural Activities",
  "Others",
] as const;

export type Domain = (typeof DOMAINS)[number];

// ─── Domain Inference ─────────────────────────────────────────────────────────
// Keyword → domain mapping. Order matters: first matching keyword wins.
// Multiple domains may be matched for a single question.

const DOMAIN_KEYWORDS: [Domain, RegExp][] = [
  ['Soil Health and Nutrient Management',    /\b(soil|soil\s*test|soil\s*health|ph\s*value|EC\s*value|organic\s*carbon|salinity|alkaline|acidic|nutrient|fertilizer|npk|manure|compost|urea|daap|dap|zinc|iron|boron|potash|micronutrient|macro\s*nutrient|organic\s*matter|soil\s*health\s*card|SHC|nutrient\s*deficiency|soil\s*report|gypsum|mop|potassium\s*sulfate|SSP)\b/i],
  ['Irrigation and Water Management',        /\b(irrigation|water|drip|sprinkler|flood|flooding|drought|rainfed|rainfall|monsoon|groundwater|canal|pond|well|borewell|tubewell|moisture|drip\s*irrigation|micro\s*irrigation|water\s*harvesting|rainwater|check\s*dam|basin|ridge)\b/i],
  ['Insect - Pest Management',               /\b(pest|insect|bug|borer|hopper|thrips|aphid|mite|termite|whitefly|mealybug|armyworm|locust|bollworm|weevil|caterpillar|plant\s*protection|spray|pesticide|insecticide|shade\s*net|windbreak)\b/i],
  ['Disease Management',                     /\b(disease|blight|rot|mildew|rust|spot|wilt|gangrene|cancer|anthracnose|powdery|downy|leaf\s*curl|mosaic|fusarium|phytophthora|fungicide)\b/i],
  ['Seed and Variety Selection',             /\b(seed|variety|cultivar|hybrid|OPV|breed|sowing|germination|seedling|seed\s*rate|seed\s*treatment|seed\s*bank|quality\s*seed|certified\s*seed|foundation\s*seed|truthful\s*seed|improved\s*variety|high\s*yield|drought\s*tolerant|short\s*duration|early\s*variety)\b/i],
  ['Cultural and Crop Management Practices', /\b(crop\s*management|cultivation|practice|intercrop|mixed\s*crop|rotation|cropping\s*system|relay\s*cropping|double\s*crop|field\s*prep|land\s*prep|ploughing|plowing|tilting|ridge|furrow|bed\s*forming|laser\s*leveler|nursery|transplanting|pruning|canopy)\b/i],
  ['Organic and Natural Farming',            /\b(organic|natural\s*farming|organic\s*certification|vermicompost|bio\s*pesticide|bio\s*fertilizer|trichoderma|bacillus|pseudomonas|azolla|mycorrhiza|neem\s*oil)\b/i],
  ['Weed Management',                        /\b(weed|weeding|herbicide|parasitic\s*weed|striga|lantana|water\s*hyacinth)\b/i],
  ['Climate, Weather & Stress Management',   /\b(weather|climate|drought|flood|heat|cold|frost|stress|el\s*nino|la\s*nina|cyclone|humidity|heat\s*wave|cold\s*wave)\b/i],
  ['Farm Tools & Mechanisation',             /\b(tractor|harvester|combine|mechanization|mechanical|power\s*tiller|rotavator|thresher|baler|drone\s*spray|tool|machine|equipment|mechanisation|drone|laser|plough|plow|cultivator|seed\s*drill)\b/i],
  ['Post-Harvest Management & Storage',      /\b(post\s*harvest|storage|silo|warehouse|cold\s*storage|grading|drying|processing|value\s*addition|threshing|milling|granary|hermetic|gunny\s*bag|godown)\b/i],
  ['Market Prices, MSP & Marketing',         /\b(market|price|MSP|mandi|procurement|selling|buying|export|contract\s*farming|marketing|market\s*information|price\s*forecast|trends|demand\s*supply|commodity\s*price)\b/i],
  ['Agricultural Schemes & Subsidies',       /\b(scheme|subsidy|government|PM\s*KISAN|grant|assistance|benefit|eligibility|certificate)\b/i],
  ['Credit, Loan & Insurance',               /\b(loan|credit|crop\s*loan|Kisan\s*Credit|kcc|debt|mortgage|interest\s*rate|bank\s*loan|insurance|crop\s*insurance|PMFBY|weather\s*based|loss\s*claim|damage\s*claim)\b/i],
  ['Capacity Building & Extension',          /\b(capacity\s*building|extension|training|farmers?\s*training|demonstration|field\s*day|workshop|awareness|skill\s*development|technology\s*transfer|advisory|extension\s*service)\b/i],
  ['Rural Infrastructure',                   /\b(rural\s*infrastructure|road|electricity|power\s*supply|cold\s*chain|market\s*infrastructure|godown|warehouse\s*infrastructure|storage\s*facility|processing\s*facility|drying\s*yard|pack\s*house|grading\s*facility)\b/i],
  ['Animal Husbandry & Livestock',           /\b(livestock|cattle|buffalo|cow|bull|goat|sheep|poultry|chicken|broiler|layer|dairy|milk\s*production|animal\s*health|animal\s*disease|foot\s*and\s*mouth|FMD|deworming|breeding|artificial\s*insemination|AI\s*technique|calf\s*rearing|fodder|green\s*fodder|concentrate\s*feed|mineral\s*supplement|vaccination|livestock\s*insurance)\b/i],
  ['Fisheries & Aquaculture',                /\b(fish|fisheries|aquaculture|fish\s*farm|fish\s*pond|shrimp|prawn|carp|catla|rohu|mrigal|tilapia|fish\s*seed|fingerling|hatchery|fish\s*feed|fish\s*disease|fish\s*health|water\s*quality|pond\s*preparation|net\s*fishing|cage\s*culture|integrated\s*farming|fish\s*processing|fish\s*marketing)\b/i],
  ['Allied Agricultural Activities',         /\b(beekeeping|honey|apiculture|sericulture|silk\s*worm|mushroom\s*cultivation|mushroom|vermicompost\s*production|coir|banana\s*fiber|bamboo\s*cultivation|floriculture|seed\s*production\s*plot|nursery\s*management|integrated\s*farming\s*system|IFS|agroforestry|agripreneurship|agri\s*startup)\b/i],
];

/**
 * Infers agriculture domains from a question text.
 * Returns up to 3 matching domains (ordered by DOMAIN_KEYWORDS precedence),
 * plus 'Others' as a fallback if nothing matched.
 */
export function inferDomains(questionText: string): Domain[] {
  const matched = new Set<Domain>();
  for (const [domain, pattern] of DOMAIN_KEYWORDS) {
    if (pattern.test(questionText)) {
      matched.add(domain);
      if (matched.size >= 3) break;
    }
  }
  if (matched.size === 0) {
    matched.add('Others');
  }
  return Array.from(matched);
}



export const CROPS = [
  "Adapathiyan", "Agathi", "Ailanthus or Matti", "Ajwain (Carom seeds)",
  "Allspice", "Almond", "Aloe vera", "Amaranth", "Amaranthus", "Amla",
  "Anthurium", "Apple", "Apricot", "Arecanut", "Arhar", "Arhar Dal (Red Gram)",
  "Aromatic Rice", "Arrow root", "Arum (Elephant Foot Yam)", "Arum Lobe", "Arum Stem",
  "Ash Gourd", "Ash gourd", "Ashwagandha", "Asoka", "Avocado",
  "Babool / Indian gum arabic tree", "Babool Tree", "Baby corn", "Babycorn",
  "Bajra/Pearl millet", "Bamboo", "Banana", "Banana Stem", "Barley",
  "Barnyard Millet", "Barnyard millet", "Beans", "Beet root", "Beetroot",
  "Bengal Gram", "Bengal Gram/Chickpea", "Ber", "Ber (Jujube)", "Berseem",
  "Betel Leaf", "Betel leaf", "Betel vine", "Bethua Leaves", "Beto Shak",
  "Bird of paradise", "Bitter Gourd", "Bitter gourd", "Black Cumin", "Black Gram",
  "Black Grapes", "Black Pepper", "Black gram", "Black pepper", "Blueberry",
  "Bottle Gourd", "Bottle gourd", "Brahmi", "Brinjal", "Brinjal (Eggplant)",
  "Brinjal / Eggplant", "Broad beans", "Broccoli", "Brocolli", "Brown Top Millet",
  "Buckwheat", "Butter / Mahua Tree", "Cabbage", "Camboge", "Capsicum", "Cardamom",
  "Carnation", "Carom", "Carrot", "Cashew", "Cassava (Tapioca)", "Cassia", "Castor",
  "Casuarina", "Cauliflower", "Celery", "Celery Seeds", "Ceylon Spinach",
  "Chadachi", "Char Magaz", "Chayote", "Chengazhinirkizhangu", "Chethikoduveli",
  "Chick pea", "Chickpea", "Chickpea, Bengal gram", "Chikoo", "Chilli", "Chilly",
  "China aster", "Chinese cabbage", "Chittadalotakam", "Chittaratha", "Chow Chow",
  "Chrysanthemum", "Cinnamon", "Citronella grass", "Citrus", "Clove", "Cloves",
  "Cluster bean", "Cocoa", "Coconut", "Coffee", "Coleus", "Colocacia", "Colocasia",
  "Congosignal grass", "Coriander", "Coriander (Cilantro)", "Coriander Leaves/Seeds",
  "Cotton", "Cowpea", "Crossandra", "Cucumber", "Cumin", "Cumin Seeds",
  "Curry leaves", "Custard Apple", "Custard apple",
  "Daincha", "Danthappala", "Darjeeling Orange", "Date", "Date Palm", "Date palm",
  "Davana", "Dill leaves", "Dillseed", "Dragon Fruit", "Drumstick", "Drumstick (Moringa)",
  "Elephant Apple", "Elephant Foot Yam", "Eucalyptus",
  "Fennel", "Fenugreek", "Fenugreek (Methi)", "Field pea", "Fig", "Finger Millet",
  "Finger millet", "Firecracker flower", "Fodder cowpea", "Fodder maize",
  "Fodder sorghum", "Foxtail Millet", "Foxtail millet", "French bean",
  "Gaillardia", "Galgal (Hill Lemon)", "Gamba grass", "Garlic", "Geranium", "Gerbera",
  "German Turnip", "Gherkins", "Ginger", "Gladiolus", "Gliricidia", "Gram", "Grape",
  "Grapes", "Greater yam", "Green Cardamom", "Green Chilli", "Green Gram",
  "Green Mango", "Green Papaya", "Green Peas", "Green gram", "Green gram, Golden gram",
  "Green pea", "Greeng gram", "Ground Nut", "Groundnut", "Guava", "Guinea grass",
  "Gymnema (Sugar destroyer)",
  "Hedge lucerne", "Heliconia", "Hogplum", "Holy basil", "Honey Plant", "Hops",
  "Horse Gram", "Horse gram", "Horsegram",
  "Hyacinth Bean", "Hyacinth Bean or Lablab Bean", "Hybrid napier",
  "Indian Beech / Pongam Tree", "Indian Beech Tree", "Indian Blackberry",
  "Indian Butter Tree / Mahua", "Indian Gooseberry", "Indian Gooseberry (Amla)",
  "Indian Jujube (Ber)", "Indian gooseberry",
  "Indian hogweed / Spiny amaranth", "Indian mustard",
  "Indian sarsaparilla (Mangani root)", "Indigo", "Irul", "Ivy Gourd", "Ivy gourd",
  "Jack", "Jack Fruit", "Jack fruit", "Jackfruit", "Jamun", "Jamun fruit",
  "Japanese Persimmon", "Jasmine", "Jeevakom", "Jicama", "Jute Leaves",
  "Kacholam", "Kagzi Lime", "Kalai Dal", "Kampakam", "Kanjiram", "Karinochi",
  "Karonda", "Kashi kanagile", "Kasthurimanjal", "Kattarvazha", "Kidney Bean",
  "Kidney bean", "Kidney bean/Rajama", "Kinnow (mandarin)", "Kiwifruit", "Knol-khol",
  "Kodo millet", "Kokum", "Koovalam", "Kurumthotti", "Kusuma",
  "Lady's Finger", "Large Cardamom", "Lemon", "Lemongrass", "Lentil",
  "Lesser yarm", "Lettuce", "Lime / Lemon", "Linseed", "Linseed, Flax", "Litchi",
  "Little Millet", "Little millet", "Long melon", "Long pepper", "Loquat", "Lucerne",
  "Mahagony", "Mahogany", "Maize", "Malabar Neem", "Mandarin", "Mandarin orange",
  "Mangium", "Mango", "Mango-ginger", "Mangosteen", "Marigold", "Mash",
  "Matar Dal (Split peas)", "Mentha", "Mesta", "Millet", "Moong", "Moong Dal",
  "Moth Bean", "Moth bean", "Mung", "Mung bean", "Mushroom", "Muskmelon", "Mustard",
  "Musur Dal",
  "Napier Grass", "Neela amari", "Neem", "Neem (ground type)", "Niger", "Nilappana",
  "Nutmeg",
  "Oat", "Oats", "Oilpalm", "Okra", "Okra (Lady\u2019s finger)", "Olive", "Onion",
  "Orange", "Orange (Sweet Orange / Mosambi)", "Orchids",
  "Paddy", "Paddy/Rice", "Palmarosa", "Palmarosa grass", "Palmyra palm", "Papaya",
  "Para grass", "Paradise Tree", "Passion fruit", "Patchouli", "Pathimugham", "Pea",
  "Peach", "Pear", "Pearl Millet", "Pearl millet", "Pecan Nut",
  "Physic Nut / Jatropha", "Pickling melon", "Pigeon Pea", "Pigeon pea",
  "Pigeon pea, Red gram", "Pineapple", "Plum", "Pointed Gourd", "Pomegranate",
  "Potato", "Proso millet", "Proso milllet", "Pumpkin", "Punna", "Quina",
  "Raddish", "Radish", "Ragi", "Ramboothan", "Ramphal", "Rapeseed and Mustard",
  "Raw Bengal Gram", "Red Chilli", "Red Gram/Pigeon Pea", "Red Sandalwood",
  "Red Sanders / Red Sandalwood", "Red gram", "Rice", "Rice (Paddy)", "Ridge Gourd",
  "Ridge gourd", "Ripe Papaya", "Rose", "Rose (Greenhouse)", "Roselle / Red sorrel",
  "Rosemary", "Rosewood", "Round gourd", "Rubber", "Ryegrass",
  "Safed musli", "Safflower", "Sandal", "Sandalwood", "Sapodilla (Chiku)", "Sapota",
  "Sarpagandha (Indian snakeroot)", "Senji", "Sesame", "Sesame, Gingelly", "Setaria grass",
  "Shaftal", "Shah Marich", "Shevri", "Snake Gourd", "Snake gourd", "Sorghum",
  "Sorghum (Fodder)", "Sorghum (Rabi/Kharif)", "Soyabean", "Soybean", "Spinach",
  "Sponge gourd", "Squash", "Stevia", "Strawberry", "Stylo", "Subabul", "Sugarbeet",
  "Sugarcane", "Summer squash", "Sun hemp", "Sunflower", "Sweet Cherry",
  "Sweet Lemon", "Sweet Lime", "Sweet orange", "Sweet pepper", "Sweet potato",
  "Tamarind", "Tapioca", "Tea", "Teak", "Thembavu", "Thippali", "Thorny bamboo",
  "Thulasi", "Tobacco", "Tomato", "Tree Tomato", "Tuberose", "Tulsi (Holy basil)",
  "Turmeric", "Turnip",
  "Urd",
  "Vanilla", "Vegetable cowpea", "Venga", "Vetiver", "Vetiver (Khus grass)",
  "Walnut", "Wanga", "Water melon", "Watermelon", "West Indian Cherry", "Wheat",
  "White yam", "Wild Tamarind", "Wild date palm", "Wild indigo",
  "Wild jack or Aini", "Wood apple", "Yam",
] as const;