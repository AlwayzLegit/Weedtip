import type { Article } from './learn';

/**
 * Learn hub expansion: evergreen guides targeting the highest-volume
 * question searches (dosing, timing, terpenes, concentrates, law basics),
 * cross-linked with the strain library. Same editorial rules as the core
 * set: plain English, no medical claims, 21+ framing.
 */
export const MORE_ARTICLES: Article[] = [
  {
    slug: 'how-long-do-edibles-take-to-kick-in',
    topic: 'Body',
    title: 'How long do edibles take to kick in (and how long do they last)?',
    description:
      'Typical onset and duration for cannabis edibles, why they hit later than smoking, and how to avoid the classic double-dose mistake.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['edible-dosing-guide', 'understanding-thc-and-cbd'],
    body: [
      {
        paragraphs: [
          'Most people feel an edible 30 minutes to 2 hours after eating it, with effects peaking around the 2–4 hour mark and lasting 4–8 hours or more. That wide window is exactly why edibles have a reputation for surprising people: they are slow to arrive and long to leave.',
        ],
      },
      {
        heading: 'Why edibles take longer than smoking',
        paragraphs: [
          'When you inhale cannabis, THC reaches your bloodstream through the lungs within minutes. An edible has to travel through your stomach and liver first, where THC is converted into 11-hydroxy-THC — a compound that tends to feel stronger and last longer. Digestion speed, what you ate that day, and your metabolism all shift the timeline.',
        ],
      },
      {
        heading: 'What changes the timing',
        paragraphs: [
          'Edibles eaten on an empty stomach usually come on faster and harder; after a big meal, onset is slower and smoother. Drinks, tinctures, and anything absorbed partly in the mouth can arrive in as little as 15–30 minutes, while a dense baked good may take the full two hours.',
        ],
      },
      {
        heading: 'The golden rule: wait before taking more',
        paragraphs: [
          'The most common edible mistake is re-dosing at the 45-minute mark because "it isn\'t working," right before the first dose lands. Give an edible at least two hours before even considering more. Start with 2.5–5 mg THC if you are new, and remember you can always take more next time — you cannot take less tonight.',
        ],
      },
    ],
    faq: [
      {
        question: 'How long do edibles take to kick in?',
        answer:
          'Typically 30 minutes to 2 hours, depending on the product, your metabolism, and whether you have eaten. Drinks and tinctures tend to be faster; baked goods slower.',
      },
      {
        question: 'How long do edible effects last?',
        answer:
          'Commonly 4–8 hours, with the peak around 2–4 hours after eating. Higher doses last longer, and some people feel residual effects into the next day.',
      },
      {
        question: 'Can I take more if I don\'t feel anything after an hour?',
        answer:
          'Wait at least two hours before re-dosing. Onset past the one-hour mark is common, and stacking doses is the classic way people end up uncomfortably high.',
      },
    ],
  },
  {
    slug: 'how-long-does-weed-stay-in-your-system',
    topic: 'Body',
    title: 'How long does weed stay in your system?',
    description:
      'Rough detection windows for urine, blood, saliva, and hair tests, what actually gets detected, and the factors that stretch or shrink the timeline.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 5,
    related: ['understanding-thc-and-cbd', 'tolerance-breaks'],
    body: [
      {
        paragraphs: [
          'Drug tests don\'t look for the cannabis "high" — they look for THC metabolites, mainly THC-COOH, which your body stores in fat and releases slowly. That storage is why cannabis is detectable long after its effects are gone, and why the honest answer to "how long" is: it depends.',
        ],
      },
      {
        heading: 'Typical detection windows',
        paragraphs: [
          'Urine tests, the most common kind, generally detect occasional use for about 3 days, regular use for 5–7 days, daily use for 10–15 days, and heavy long-term use for 30 days or more. Saliva tests usually reach back 24–72 hours, blood tests a few hours to a couple of days, and hair tests up to 90 days.',
        ],
      },
      {
        heading: 'What moves the numbers',
        paragraphs: [
          'Frequency matters more than anything: metabolites accumulate with daily use, so a one-time smoker and a daily consumer are on completely different clocks. Body fat, metabolism, potency, and dose all play a role too. Edibles and smoking end up in the same place for testing purposes — the metabolites are the same.',
        ],
      },
      {
        heading: 'Can you speed it up?',
        paragraphs: [
          'Mostly no. Detox drinks, saunas, and crash exercise routines are not reliably supported by evidence — time is the only dependable factor. Hydration and exercise support your normal metabolism, but nothing credibly converts a 30-day window into a 3-day one.',
        ],
      },
    ],
    faq: [
      {
        question: 'How long is weed detectable in urine?',
        answer:
          'Roughly 3 days after one-time use, 5–7 days for regular use, and 30+ days for heavy daily use. Individual results vary with body composition and metabolism.',
      },
      {
        question: 'Do edibles stay in your system longer than smoking?',
        answer:
          'Tests detect the same THC metabolites either way. Detection windows are driven by how much and how often you consume, not by the format.',
      },
    ],
  },
  {
    slug: 'what-are-terpenes',
    topic: 'Plant',
    title: 'What are terpenes? Cannabis aromas, explained',
    description:
      'Terpenes give every strain its smell and shape its effects. Meet myrcene, limonene, caryophyllene, and the rest of the big six.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 5,
    related: ['indica-vs-sativa-vs-hybrid', 'entourage-effect'],
    relatedStrains: [
      { name: 'Blue Dream', slug: 'blue-dream' },
      { name: 'Sour Diesel', slug: 'sour-diesel' },
      { name: 'GSC', slug: 'girl-scout-cookies' },
      { name: 'Tangie', slug: 'tangie' },
    ],
    body: [
      {
        paragraphs: [
          'Terpenes are the aromatic oils that give cannabis its personality — the reason one jar smells like grapefruit and another like a pine forest or a fuel can. They are produced in the same resin glands as THC and CBD, and many people find they shape the feel of a strain as much as potency does.',
        ],
      },
      {
        heading: 'The big six',
        paragraphs: [
          'Myrcene smells earthy and musky and is associated with relaxed, heavy effects — it dominates many indicas. Limonene is bright citrus, linked to uplifted moods. Caryophyllene is peppery and spicy, and is unique for interacting with the body\'s CB2 receptors. Pinene smells like pine and is associated with alertness; linalool is lavender-floral and calming; terpinolene is fruity-herbal and shows up in energetic sativas.',
        ],
      },
      {
        heading: 'Why terpenes matter when you shop',
        paragraphs: [
          'Two strains with identical THC numbers can feel completely different, and terpenes are a big part of why. If a lab label lists the terpene profile, treat it as a flavor-and-feel preview. A simpler shortcut: note which strains you enjoy and look at their listed flavors — your nose usually knows.',
        ],
      },
    ],
    faq: [
      {
        question: 'Do terpenes get you high?',
        answer:
          'No — terpenes are not intoxicating on their own. They contribute aroma and flavor and appear to modulate how a strain feels alongside THC.',
      },
      {
        question: 'What is the most common terpene in cannabis?',
        answer:
          'Myrcene. It has an earthy, musky aroma and is especially common in indica-leaning strains associated with relaxation.',
      },
    ],
  },
  {
    slug: 'edible-dosing-guide',
    topic: 'Body',
    title: 'Edible dosing guide: how many mg of THC should you take?',
    description:
      'A practical mg-by-mg guide to edible doses — what 2.5, 5, 10, and 50+ mg of THC actually feel like, and how to find your number safely.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 5,
    related: ['how-long-do-edibles-take-to-kick-in', 'understanding-thc-and-cbd'],
    body: [
      {
        paragraphs: [
          'Edible potency is measured in milligrams of THC, and small numbers do real work. The right dose is personal — tolerance, body chemistry, and even your mood change the outcome — but the ranges below are a widely used starting map.',
        ],
      },
      {
        heading: '1–2.5 mg: microdose',
        paragraphs: [
          'Mild relief and subtle mood lift with little to no impairment. This is the recommended starting point for true beginners and people sensitive to THC.',
        ],
      },
      {
        heading: '2.5–5 mg: low dose',
        paragraphs: [
          'The standard "first real edible" range: noticeable relaxation and euphoria for most occasional users while staying functional. Many states define 5 mg as one serving.',
        ],
      },
      {
        heading: '5–15 mg: moderate',
        paragraphs: [
          'Stronger euphoria and impaired coordination — a full recreational experience for occasional users, a routine dose for regulars. Clear your calendar the first time you try double digits.',
        ],
      },
      {
        heading: '15–50 mg and beyond',
        paragraphs: [
          'High doses meant for experienced consumers and high-tolerance medical patients. Above 50 mg, side effects like anxiety, nausea, and racing heart become much more likely for anyone without a serious tolerance. More is not better — comfortable is better.',
        ],
      },
      {
        heading: 'Finding your number',
        paragraphs: [
          'Start at 2.5 mg, wait a full two hours, and only step up by 2.5–5 mg per session across different days. Log what you took and how it felt. If you overshoot: hydrate, find a calm place, and remember it passes — no one has fatally overdosed on cannabis, but an uncomfortable evening is very possible.',
        ],
      },
    ],
    faq: [
      {
        question: 'How many mg of THC should a beginner take?',
        answer:
          'Start with 2.5 mg — half of a standard 5 mg serving — and wait at least two hours before considering more.',
      },
      {
        question: 'Is 10 mg of THC a lot?',
        answer:
          'For a first-timer, yes: 10 mg is a full double serving and can be intense. For regular consumers it is a common moderate dose.',
      },
      {
        question: 'What should I do if I took too much?',
        answer:
          'Stay calm, hydrate, eat something, and rest somewhere comfortable — effects fade over several hours. CBD may take the edge off for some people. Seek medical help if symptoms feel severe.',
      },
    ],
  },
  {
    slug: 'what-is-thca',
    topic: 'Dictionary',
    title: 'What is THCA? The raw cannabinoid behind the % on your label',
    description:
      'THCA is the non-intoxicating precursor to THC found in raw cannabis flower. Here\'s how heat turns it into THC and how to read THCA percentages.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['understanding-thc-and-cbd', 'cannabis-concentrates-guide'],
    body: [
      {
        paragraphs: [
          'THCA (tetrahydrocannabinolic acid) is the form THC takes in the living plant and in raw, cured flower. On its own it is not intoxicating — you could eat raw flower all day and not feel high. The magic happens with heat.',
        ],
      },
      {
        heading: 'Decarboxylation: how THCA becomes THC',
        paragraphs: [
          'Lighting a bowl, running a vaporizer, or baking flower in a low oven converts THCA into THC by knocking off a carboxyl group — a process called decarboxylation. That is why flower must be heated (or professionally processed) before it is psychoactive, and why edibles are made with decarbed cannabis rather than raw plant.',
        ],
      },
      {
        heading: 'Reading THCA on a label',
        paragraphs: [
          'Lab labels often list THCA and THC separately. Because THCA loses some mass during conversion, the usable "total THC" is roughly THC + (THCA × 0.877). Most menus do that math for you, but knowing it explains why a jar can say "THCA 24%, THC 0.8%" and still be very strong.',
        ],
      },
      {
        heading: 'Why THCA is in the news',
        paragraphs: [
          'Because hemp is defined federally by its delta-9 THC content, some sellers market high-THCA hemp flower that becomes ordinary THC when smoked. Rules vary widely and are changing fast — buying from licensed dispensaries keeps you inside your state\'s tested, regulated supply.',
        ],
      },
    ],
    faq: [
      {
        question: 'Does THCA get you high?',
        answer:
          'Not in its raw form. Once heated — smoked, vaped, or baked — THCA converts to THC, which is intoxicating.',
      },
      {
        question: 'What does a THCA percentage mean on flower?',
        answer:
          'It is the potency locked in the raw flower. Multiply THCA by about 0.877 and add any listed THC to estimate the total THC you\'ll get after heating.',
      },
    ],
  },
  {
    slug: 'delta-8-vs-delta-9',
    topic: 'Dictionary',
    title: 'Delta-8 vs Delta-9 THC: what\'s actually different?',
    description:
      'Delta-8 and delta-9 are close chemical cousins with different strength, legality, and oversight. Here\'s a clear comparison before you buy either.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['what-is-thca', 'medical-vs-recreational'],
    body: [
      {
        paragraphs: [
          'Delta-9 THC is the main intoxicating compound in cannabis — the one people mean when they say "THC." Delta-8 is a chemically similar cannabinoid that occurs in tiny natural amounts and is usually manufactured from hemp-derived CBD for the products you see sold outside dispensaries.',
        ],
      },
      {
        heading: 'Strength and feel',
        paragraphs: [
          'Delta-8 is commonly described as noticeably milder than delta-9 — often estimated at half to two-thirds the potency — with a smoother, less anxious edge for some people. Milder does not mean harmless: it is still intoxicating, still impairing, and still shows up on drug tests.',
        ],
      },
      {
        heading: 'The regulation gap',
        paragraphs: [
          'Licensed dispensary products (delta-9) are tested for potency and contaminants under state rules. Delta-8 sold in vape shops and gas stations often is not — studies have found mislabeled potency and residual solvents in unregulated products. Several states have banned or restricted delta-8 outright, so check your local rules.',
        ],
      },
      {
        heading: 'Which should you choose?',
        paragraphs: [
          'If you live in a legal state, regulated delta-9 products from licensed dispensaries offer known potency, testing, and recourse. If delta-8 is the only legal option where you are, buy from brands that publish full third-party lab results and start with a low dose.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is delta-8 legal?',
        answer:
          'It depends on the state. Delta-8 exists in a federal gray zone from the 2018 hemp bill, and a growing list of states have banned or restricted it. Check your state\'s current rules.',
      },
      {
        question: 'Will delta-8 fail a drug test?',
        answer:
          'Very likely yes. Standard tests detect THC metabolites and generally cannot distinguish delta-8 from delta-9 use.',
      },
    ],
  },
  {
    slug: 'cannabis-concentrates-guide',
    topic: 'Products',
    title: 'Cannabis concentrates 101: wax, shatter, live resin, and rosin',
    description:
      'A beginner-safe map of the concentrate case — how wax, shatter, budder, live resin, and rosin differ, and how people actually use them.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 5,
    related: ['what-is-live-resin', 'vaping-vs-smoking'],
    body: [
      {
        paragraphs: [
          'Concentrates are cannabis with the plant material stripped away, leaving the resin — and potencies of 60–90% THC versus 15–30% for strong flower. The names on the case mostly describe texture and extraction method, not wildly different substances.',
        ],
      },
      {
        heading: 'Textures: shatter, wax, budder, crumble',
        paragraphs: [
          'Shatter is glassy and brittle; wax is soft and pliable; budder is whipped and creamy; crumble is dry and, yes, crumbly. All are typically made with solvents like butane or CO2 that are purged before sale, and all are used mostly the same way — dabbed on a hot surface or added to flower.',
        ],
      },
      {
        heading: 'Live resin and rosin',
        paragraphs: [
          'Live resin is extracted from flash-frozen fresh plants instead of dried flower, preserving far more terpenes — expect louder flavor and aroma. Rosin skips solvents entirely: it is pressed out with heat and pressure. "Live rosin" (fresh-frozen, solventless) sits at the top of most price lists for that reason.',
        ],
      },
      {
        heading: 'How concentrates are consumed',
        paragraphs: [
          'Dab rigs and e-rigs vaporize concentrates at high heat for full effect and flavor. Simpler routes: 510 vape cartridges are pre-filled concentrates, and a pinch of wax on top of a bowl upgrades ordinary flower. Because potency is several times higher than flower, start with a dose the size of a grain of rice.',
        ],
      },
    ],
    faq: [
      {
        question: 'Are concentrates stronger than flower?',
        answer:
          'Much stronger — commonly 60–90% THC versus 15–30% for flower. Doses should be correspondingly tiny, especially at first.',
      },
      {
        question: 'What is the difference between live resin and rosin?',
        answer:
          'Live resin is solvent-extracted from fresh-frozen plants; rosin is squeezed out with only heat and pressure. Live rosin combines both ideas: fresh-frozen and solventless.',
      },
    ],
  },
  {
    slug: 'what-is-live-resin',
    topic: 'Dictionary',
    title: 'What is live resin?',
    description:
      'Live resin is a flavor-first concentrate made from fresh-frozen cannabis. Here\'s why it tastes different and costs more.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 3,
    related: ['cannabis-concentrates-guide', 'what-are-terpenes'],
    body: [
      {
        paragraphs: [
          'Most concentrates start from dried, cured flower. Live resin starts from plants that are frozen at harvest — skipping the drying that burns off a large share of a plant\'s terpenes. The result is a concentrate that smells and tastes dramatically more like the living plant.',
        ],
      },
      {
        heading: 'Why people pay more for it',
        paragraphs: [
          'Terpenes, not THC, are what live resin protects. Two carts with the same potency can taste like nothing and like a fresh strain respectively — that difference is usually the "live" part. For consumers who care about flavor and strain character, it is the noticeable upgrade.',
        ],
      },
      {
        heading: 'Live resin vs live rosin',
        paragraphs: [
          'Both start fresh-frozen. Live resin uses solvents (purged before sale); live rosin is pressed without solvents, which is harder to produce and typically the most expensive item in the case. Nomenclature matters at the register, so read the label.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is live resin stronger than regular concentrate?',
        answer:
          'Not necessarily — its THC range is similar. The difference is terpene content: live resin preserves the plant\'s fresh aroma and flavor.',
      },
    ],
  },
  {
    slug: 'vaping-vs-smoking',
    topic: 'Products',
    title: 'Vaping vs smoking cannabis: what\'s the difference?',
    description:
      'Onset, flavor, smell, and harshness compared — how vaporizers, carts, joints, and bowls differ so you can pick the format that fits.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['cannabis-concentrates-guide', 'how-to-store-cannabis'],
    body: [
      {
        paragraphs: [
          'Both vaping and smoking deliver effects within minutes, which makes them the easiest formats to dose — you feel where you are before deciding on another puff. The differences come down to what\'s being heated and how hot.',
        ],
      },
      {
        heading: 'Smoking: combustion',
        paragraphs: [
          'Joints, bowls, and bongs burn flower at high temperatures. You get the classic ritual, the full flower flavor up front, and the strongest smell that lingers on clothes and rooms. Combustion also produces smoke and tar — the harshest option on your throat and lungs.',
        ],
      },
      {
        heading: 'Vaping: hot air, not fire',
        paragraphs: [
          'Dry-herb vaporizers heat flower below combustion, releasing cannabinoids and terpenes as vapor: smoother pulls, more nuanced flavor, dramatically less smell, and more efficient use of the same eighth. Cartridge vapes heat concentrated oil instead — maximum convenience and discretion, with potency well above flower.',
        ],
      },
      {
        heading: 'Choosing between them',
        paragraphs: [
          'Pick smoking for ritual and simplicity, dry-herb vaping for flavor and gentler sessions with the same flower, and carts for portability. Whatever the format, buy tested products from licensed dispensaries — the vape-injury outbreak of 2019 traced overwhelmingly to illicit-market additives, not regulated products.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is vaping cannabis stronger than smoking?',
        answer:
          'Cartridges are typically far more potent than flower (60–90% THC vs 15–30%). Dry-herb vaping is comparable to smoking the same flower, often feeling cleaner and more efficient.',
      },
      {
        question: 'Does vaping smell less than smoking?',
        answer:
          'Yes — vapor dissipates quickly and doesn\'t cling to fabric the way smoke does, though it isn\'t completely odorless.',
      },
    ],
  },
  {
    slug: 'how-to-store-cannabis',
    topic: 'Products',
    title: 'How to store cannabis so it stays fresh',
    description:
      'Light, air, heat, and humidity are what age your flower. Simple storage rules — and how long flower, edibles, and carts actually keep.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['vaping-vs-smoking', 'edible-dosing-guide'],
    body: [
      {
        paragraphs: [
          'Cannabis doesn\'t spoil like milk, but it does degrade: THC slowly converts to CBN (sleepy, less euphoric), terpenes evaporate, and flower dries to dust or — worse — molds if kept damp. Four enemies do the damage: light, oxygen, heat, and wrong humidity.',
        ],
      },
      {
        heading: 'The setup that works',
        paragraphs: [
          'An airtight glass jar, stored in a cool dark cupboard, solves most of it. UV light is the fastest degrader, so opaque or tinted jars beat clear ones on a sunny shelf. Aim for roughly 55–65% relative humidity — the two-way humidity packs sold at dispensaries hold that range for months.',
        ],
      },
      {
        heading: 'What to avoid',
        paragraphs: [
          'Skip the refrigerator and freezer for flower — temperature swings pull moisture in and freezing snaps trichomes off. Plastic baggies build static that strips resin, and stashing near appliances or windows cooks off terpenes. Keep everything locked away from kids and pets; edibles especially look like ordinary snacks.',
        ],
      },
      {
        heading: 'How long things keep',
        paragraphs: [
          'Well-stored flower stays great for 6–12 months. Sealed edibles follow the food they\'re made of — gummies outlast baked goods by months. Vape carts and concentrates hold a year or more in cool darkness. If flower smells like hay or nothing at all, its terpenes are gone; if you see fuzz or smell must, throw it out.',
        ],
      },
    ],
    faq: [
      {
        question: 'Does weed expire?',
        answer:
          'It degrades rather than expires: potency and flavor fade over about a year, and damp storage can grow mold. Moldy cannabis should be discarded.',
      },
      {
        question: 'Should I keep cannabis in the fridge?',
        answer:
          'No — fridge and freezer temperature swings add moisture and damage trichomes. A cool, dark cupboard in an airtight glass jar is better.',
      },
    ],
  },
  {
    slug: 'medical-vs-recreational',
    topic: 'Laws',
    title: 'Medical vs recreational cannabis: what\'s the difference?',
    description:
      'Who can buy, how much, at what tax rate, and why millions still hold medical cards in fully legal states.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['can-you-fly-with-weed', 'what-to-bring-to-a-dispensary'],
    body: [
      {
        paragraphs: [
          'Medical and recreational (adult-use) cannabis often sit on the same dispensary shelves — the difference is the rules around the purchase, not usually the plant itself.',
        ],
      },
      {
        heading: 'Access and age',
        paragraphs: [
          'Recreational purchases require being 21+ with a valid ID in a legal state — no paperwork beyond that. Medical programs require a qualifying condition and a physician\'s recommendation, in exchange for access at 18+ in most programs (younger with a caregiver), and they exist in many states that haven\'t legalized adult use.',
        ],
      },
      {
        heading: 'Why people keep medical cards in legal states',
        paragraphs: [
          'Money and limits. Medical purchases are taxed far less in most states — recreational taxes can stack 20–40% while medical often skips excise taxes entirely. Cardholders typically get higher possession and purchase limits, access to higher-potency products, and priority during shortages.',
        ],
      },
      {
        heading: 'At the counter',
        paragraphs: [
          'Some dispensaries are dual-licensed with separate menus or lines; others serve one market only. Weedtip listings show whether a shop serves medical patients, recreational customers, or both — filter for what you need before you drive.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is medical cannabis cheaper than recreational?',
        answer:
          'Usually, yes — medical purchases skip most excise taxes in the majority of states, which can save 20% or more per purchase.',
      },
      {
        question: 'Can I buy recreational cannabis with a medical card from another state?',
        answer:
          'In adult-use states you can simply buy recreationally at 21+. A handful of medical-only states honor out-of-state cards; most do not. Check the destination state\'s rules.',
      },
    ],
  },
  {
    slug: 'can-you-fly-with-weed',
    topic: 'Laws',
    title: 'Can you fly with weed? Cannabis and travel, explained',
    description:
      'Cannabis remains federally illegal, and airports and state lines are where that matters most. What TSA actually does, and the rules for cars and borders.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['medical-vs-recreational'],
    body: [
      {
        paragraphs: [
          'The short answer: transporting cannabis across state lines is federally illegal even between two legal states, and airspace is federal jurisdiction. The practical answer has more texture — here is how it plays out.',
        ],
      },
      {
        heading: 'Airports and TSA',
        paragraphs: [
          'TSA screens for security threats, not drugs, and says so explicitly — officers don\'t search for cannabis, but if they find it they refer it to local police. In legal states that usually ends with disposal ("amnesty boxes" exist at some airports) or nothing; in prohibition states it can mean charges. Federally legal hemp CBD under 0.3% THC is allowed in carry-ons.',
        ],
      },
      {
        heading: 'Driving',
        paragraphs: [
          'Within a legal state, transport cannabis in its sealed dispensary packaging, in the trunk — open containers in the cabin are a citation in most states. Crossing any state line with cannabis is federal trafficking territory regardless of the states involved, and prohibition states along your route will enforce their own laws.',
        ],
      },
      {
        heading: 'The safest pattern',
        paragraphs: [
          'Buy where you land. Legal-state dispensaries are everywhere your trip is likely to take you — find one near your destination on Weedtip rather than packing anything. International borders are a hard no in both directions, including Canada despite its federal legality.',
        ],
      },
    ],
    faq: [
      {
        question: 'Can I fly with weed between two legal states?',
        answer:
          'It remains federally illegal — airports and airspace are federal jurisdiction. TSA refers discovered cannabis to local police, whose response depends on the state.',
      },
      {
        question: 'Can I fly with CBD?',
        answer:
          'Hemp-derived CBD products containing under 0.3% THC are federally legal and allowed by TSA, subject to normal liquid rules.',
      },
    ],
  },
  {
    slug: 'entourage-effect',
    topic: 'Plant',
    title: 'What is the entourage effect?',
    description:
      'The theory that cannabinoids and terpenes work better together than alone — what the evidence says and what it means for choosing products.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['what-are-terpenes', 'understanding-thc-and-cbd'],
    body: [
      {
        paragraphs: [
          'The entourage effect is the idea that cannabis compounds — THC, CBD, minor cannabinoids, and terpenes — modulate each other, so a whole-plant product feels different from isolated THC at the same dose. It is why two products with identical potency numbers can deliver very different experiences.',
        ],
      },
      {
        heading: 'Where the idea comes from',
        paragraphs: [
          'The term dates to 1998 research by Raphael Mechoulam\'s group, and the everyday evidence is familiar: CBD appears to soften THC\'s edge, and terpene-rich products are widely reported to feel more dimensional than distillate. Rigorous human trials remain limited, so scientists describe it as plausible and partially supported rather than proven.',
        ],
      },
      {
        heading: 'What it means at the counter',
        paragraphs: [
          'Full-spectrum products (live resin, rosin, whole flower) preserve the plant\'s original mix; distillate is nearly pure THC, often with terpenes re-added for flavor. If distillate carts feel one-note or edgy to you, a full-spectrum option or a product with some CBD is the experiment worth running. Chasing the highest THC number is usually the least informative way to shop.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is the entourage effect scientifically proven?',
        answer:
          'It is a well-grounded hypothesis with supporting preclinical work and abundant anecdotal report, but definitive human trials are still limited.',
      },
      {
        question: 'What does full-spectrum mean?',
        answer:
          'A product that preserves the plant\'s broader mix of cannabinoids and terpenes rather than isolating THC alone — examples include whole flower, live resin, and rosin.',
      },
    ],
  },
  {
    slug: 'cbg-cbn-minor-cannabinoids',
    topic: 'Body',
    title: 'CBG, CBN, and CBC: minor cannabinoids explained',
    description:
      'Beyond THC and CBD, labels increasingly list CBG, CBN, and CBC. What each one is and why products feature them.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['understanding-thc-and-cbd', 'entourage-effect'],
    body: [
      {
        paragraphs: [
          'THC and CBD headline every label, but the plant makes over a hundred cannabinoids. Three now show up in named products: CBG, CBN, and CBC. None is intoxicating the way THC is; each is marketed around a different use case.',
        ],
      },
      {
        heading: 'CBG: the "mother cannabinoid"',
        paragraphs: [
          'CBG (cannabigerol) is the precursor the plant converts into THC and CBD, so mature flower holds only traces — dedicated high-CBG cultivars supply the market. It is non-intoxicating and typically positioned around focus and calm; early research is active but young.',
        ],
      },
      {
        heading: 'CBN: the sleepy one',
        paragraphs: [
          'CBN (cannabinol) is what THC degrades into with age and oxidation — old flower is naturally higher in it. Mildly psychoactive at most, it is the cannabinoid most often blended into sleep-branded gummies, usually paired with THC and sometimes melatonin. Evidence for CBN alone as a sleep aid is thin; the blends are what people actually buy.',
        ],
      },
      {
        heading: 'CBC and how to shop the minors',
        paragraphs: [
          'CBC (cannabichromene) is non-intoxicating and studied mostly in preclinical settings. Treat all minor-cannabinoid claims as early-stage: look for products that state actual milligram amounts rather than fairy-dust mentions, and judge by your own results at consistent doses.',
        ],
      },
    ],
    faq: [
      {
        question: 'Does CBN really make you sleepy?',
        answer:
          'Evidence for CBN alone is limited. Most sleep products pair CBN with THC, and that combination — plus dose and timing — likely does most of the work.',
      },
      {
        question: 'Will CBG or CBN get me high?',
        answer:
          'CBG is non-intoxicating; CBN is at most very mildly psychoactive. Neither delivers a THC-style high at product doses.',
      },
    ],
  },
  {
    slug: 'tolerance-breaks',
    topic: 'Body',
    title: 'Tolerance breaks: how long does it take to reset?',
    description:
      'Why cannabis feels weaker over time, how long a t-break actually needs to be, and how to make one stick.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 4,
    related: ['how-long-does-weed-stay-in-your-system', 'edible-dosing-guide'],
    body: [
      {
        paragraphs: [
          'Regular THC use downregulates the brain\'s CB1 receptors — the ones THC activates — so the same dose does less over time. A tolerance break ("t-break") gives those receptors time to return to baseline, and it is the only reliable way to bring the magic back without escalating dose.',
        ],
      },
      {
        heading: 'How long is enough?',
        paragraphs: [
          'Receptor recovery starts within about 2 days and research shows substantial return toward baseline within about 4 weeks of abstinence. Practical rule of thumb: even 3–7 days noticeably freshens things for lighter consumers, while daily users get the most from 2–4 weeks. Longer than a month buys little additional reset.',
        ],
      },
      {
        heading: 'What the first days feel like',
        paragraphs: [
          'Daily consumers may notice irritability, restless sleep, vivid dreams, and reduced appetite for the first several days — that is THC leaving a system used to it, and it passes within a week or two. Hydration, exercise, and keeping busy in the evenings (the usual session time) carry most people through.',
        ],
      },
      {
        heading: 'Alternatives to a full break',
        paragraphs: [
          'If a clean break isn\'t realistic, reduce frequency (weekends only), drop potency (lower-THC flower instead of concentrates), or set a lower fixed dose. Slower, but the direction is the same. When you return, start at half your old dose — the reset is real.',
        ],
      },
    ],
    faq: [
      {
        question: 'How long should a tolerance break be?',
        answer:
          'Even 3–7 days helps; 2–4 weeks gives daily consumers most of the available reset, with receptor recovery largely complete around the four-week mark.',
      },
      {
        question: 'Do tolerance breaks really work?',
        answer:
          'Yes — imaging studies show CB1 receptor availability recovering with abstinence, which is why effects feel stronger after a break.',
      },
    ],
  },
  {
    slug: 'how-to-read-cannabis-labels',
    topic: 'Products',
    title: 'How to read a cannabis label (and its lab results)',
    description:
      'Potency percentages, total THC math, terpene lists, and batch dates — a field guide to the fine print on legal cannabis packaging.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readMinutes: 5,
    related: ['what-is-thca', 'what-are-terpenes'],
    body: [
      {
        paragraphs: [
          'Legal cannabis comes with more label than most groceries. Once you can read it, the fine print answers the questions that matter: how strong, how fresh, what it will taste like, and whether it was tested.',
        ],
      },
      {
        heading: 'Potency: THC, THCA, and totals',
        paragraphs: [
          'Flower labels usually show THCA (the raw form) and delta-9 THC separately, plus a "total THC" that applies the conversion math (THC + THCA × 0.877). Edibles list milligrams per piece and per package. Comparing products? Use total THC for flower and mg for edibles — and remember terpenes shape the feel as much as a few potency points.',
        ],
      },
      {
        heading: 'Dates and batch numbers',
        paragraphs: [
          'Look for harvest or production dates: flower is at its best within 6–12 months, and terpene-forward products reward freshness. The batch number ties your product to its certificate of analysis (COA) — the lab report behind the label, often reachable by QR code.',
        ],
      },
      {
        heading: 'Reading the COA',
        paragraphs: [
          'A COA confirms potency and screens for pesticides, mold, heavy metals, and residual solvents. You mostly need two checks: the potency section should match the label, and every contaminant row should read "pass" or "ND" (not detected). A brand that makes COAs hard to find is telling you something.',
        ],
      },
    ],
    faq: [
      {
        question: 'What does total THC mean on a label?',
        answer:
          'The THC you\'ll actually get after heating: delta-9 THC plus THCA multiplied by 0.877 to account for conversion loss.',
      },
      {
        question: 'What is a COA?',
        answer:
          'A certificate of analysis — the third-party lab report showing a batch\'s potency and contaminant screening results. Licensed products link each package to one by batch number.',
      },
    ],
  },
];
