/**
 * Learn library, wave 3 (2026-07-19): first-visit, pricing, etiquette, and
 * body-topic head terms the first two waves didn't cover. Same data shape as
 * lib/learn.ts — see the Article interface there.
 */
import type { Article } from './learn';

export const MORE_ARTICLES_3: Article[] = [
  {
    slug: 'first-time-dispensary-visit',
    topic: 'Ordering',
    title: 'Your first dispensary visit: what to expect, step by step',
    description:
      'Nervous about your first trip to a dispensary? Here is exactly what happens at the door, at the counter, and at checkout — plus what to bring.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Walking into a dispensary for the first time can feel intimidating — there is a security check, unfamiliar jargon, and a menu with dozens of products you have never heard of. The good news: dispensaries are built for beginners, and the whole visit usually takes ten relaxed minutes. Here is what actually happens.',
        ],
      },
      {
        heading: 'At the door: the ID check',
        paragraphs: [
          'Every licensed dispensary checks ID before you enter the sales floor. Bring a valid, unexpired government-issued photo ID — a driver’s license, state ID, or passport. You must be 21 or older in adult-use states, or a registered patient with your medical card in medical-only states. A paper copy or a photo of your ID on your phone does not count.',
          'Some shops have a small check-in lobby where a receptionist scans your ID and buzzes you in; others check at the counter. Either way, this step is required by law, not a judgment call — even obvious seniors get carded.',
        ],
      },
      {
        heading: 'On the floor: talk to the budtender',
        paragraphs: [
          'Budtenders — the staff behind the counter — answer beginner questions all day, and helping first-timers is most of the job. Tell them how you want to feel (relaxed, social, sleepy, clear-headed), how experienced you are, and how you prefer to consume (smoke, vape, eat). They will point you to a starting product and dose.',
          'Do not be embarrassed to say it is your first time. You will get better recommendations — usually a low-dose edible, a pre-roll, or a mild flower strain — than if you pretend to know the menu.',
        ],
      },
      {
        heading: 'Checkout: cash is still king',
        paragraphs: [
          'Because federal banking rules limit card processing at many dispensaries, plenty of shops are cash-only or charge an ATM-style fee for debit. Bring cash or check the shop’s listing for accepted payment types before you go. Expect state and local cannabis taxes on top of shelf prices — the total can run 10–35% higher depending on where you live.',
          'Your products come in sealed, child-resistant packaging. Keep them sealed in the trunk on the drive home — open containers in the cabin are illegal in most states, similar to alcohol.',
        ],
      },
      {
        heading: 'Skip the line: order ahead online',
        paragraphs: [
          'Most dispensaries let you browse the live menu and reserve products online for in-store pickup. You still show ID and pay at the counter, but your order is bagged and waiting. It is the easiest way to shop as a beginner — you can research products calmly at home instead of deciding at the counter.',
        ],
      },
    ],
    faq: [
      {
        question: 'Do I need a medical card to shop at a dispensary?',
        answer:
          'Not in adult-use (recreational) states — anyone 21+ with a valid ID can buy. In medical-only states you need a patient registration or medical card. Each dispensary page on Weedtip shows whether it serves recreational customers, medical patients, or both.',
      },
      {
        question: 'How much should I buy on my first visit?',
        answer:
          'Start small: a single pre-roll, one low-dose edible pack (2.5–5 mg THC per piece), or a gram of flower. You can always come back — starting light lets you learn what you like without wasting money.',
      },
      {
        question: 'Can I use a credit card at a dispensary?',
        answer:
          'Usually not. Federal banking restrictions mean most dispensaries accept cash and, sometimes, debit with a small fee. Check the listing for payment options and look for an on-site ATM.',
      },
    ],
    related: ['what-to-bring-to-a-dispensary', 'how-to-order-cannabis-online', 'weed-measurements-and-prices', 'dispensary-etiquette'],
  },
  {
    slug: 'weed-measurements-and-prices',
    topic: 'Ordering',
    title: 'Weed measurements explained: grams, eighths, ounces — and what they cost',
    description:
      'A gram, an eighth, a quarter, an ounce — what each cannabis measurement means, how many joints it rolls, and the typical price range for each.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Dispensary flower menus are priced by weight, and the units come from an odd mix of metric and imperial: grams on the small end, fractions of an ounce above that. Here is the ladder, what each amount is actually good for, and what it typically costs in a licensed shop.',
        ],
      },
      {
        heading: 'The ladder: gram to ounce',
        paragraphs: [
          'A gram (1 g) is the smallest amount most shops sell — enough for one to two joints. It is the right size for trying a new strain.',
          'An eighth (3.5 g, one-eighth of an ounce) is the most popular purchase in America — roughly five to seven joints, or a week or two of light evening use. Most shelf prices you see quoted are eighth prices.',
          'A quarter (7 g), half (14 g), and ounce (28 g) scale up from there. An ounce is the legal possession limit in many adult-use states, and per-gram pricing drops meaningfully as you buy larger sizes.',
        ],
      },
      {
        heading: 'What flower typically costs',
        paragraphs: [
          'Prices vary a lot by state, taxes, and shelf tier, but broad licensed-market ranges look like this: grams around $5–15, eighths around $20–60, quarters around $40–110, and ounces around $80–300. Mature markets like Oklahoma, Oregon, and Michigan sit at the low end; newer or high-tax markets run higher.',
          'Within one shop you will see budget, mid-shelf, and top-shelf tiers. The difference is genetics, growing method (indoor commands a premium), freshness, and brand — not safety; everything on a licensed shelf passed the same state testing.',
        ],
      },
      {
        heading: 'Non-flower products price differently',
        paragraphs: [
          'Edibles are priced per package with the THC total on the label — a typical 100 mg package (ten 10 mg pieces) runs $10–25. Vape cartridges are priced by oil volume, usually $25–60 for a half-gram or full gram. Concentrates run $20–70 per gram depending on extraction type.',
          'Comparing price-per-milligram of THC across product types is the budget shopper’s trick: edibles and concentrates usually deliver THC cheaper than flower, though the experience differs.',
        ],
      },
      {
        heading: 'How to pay less',
        paragraphs: [
          'Shop deals first — daily specials, first-time customer discounts, and bundle pricing are everywhere in competitive markets. On Weedtip, the Deals page shows what is running near you today, and buying a size up almost always beats buying grams twice.',
        ],
      },
    ],
    faq: [
      {
        question: 'How many joints does an eighth roll?',
        answer:
          'Five to seven average joints (about half a gram each), or three to four larger ones. Pre-rolls sold in shops are usually 0.5 g or 1 g each.',
      },
      {
        question: 'Why is dispensary weed more expensive than street prices?',
        answer:
          'Licensed products carry state testing, packaging, and cannabis taxes that can add 10–35%. In return you get lab-verified potency and contaminant screening, plus deals that often close most of the gap.',
      },
      {
        question: 'What is the biggest amount I can buy at once?',
        answer:
          'Most adult-use states cap purchases at one ounce of flower (sometimes more) per day, with separate limits for concentrates and edibles. The dispensary tracks this at checkout, so you cannot accidentally exceed it.',
      },
    ],
    related: ['how-to-order-cannabis-online', 'first-time-dispensary-visit', 'how-to-read-cannabis-labels', 'edible-dosing-guide'],
  },
  {
    slug: 'dispensary-etiquette',
    topic: 'Ordering',
    title: 'Dispensary etiquette: 9 unwritten rules budtenders wish you knew',
    description:
      'From tipping norms to what not to ask at the counter — the simple etiquette that makes dispensary visits smoother for everyone.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'Dispensaries are welcoming places, but like any specialty shop they have norms regulars pick up over time. None of these are laws — they are the difference between an okay visit and a great one.',
        ],
      },
      {
        heading: 'Have your ID out — every time',
        paragraphs: [
          'The check happens on every visit, no matter how many times they have seen you. Having your ID ready before you reach the door keeps the line moving and is the single most appreciated habit.',
        ],
      },
      {
        heading: 'Know roughly what you want (or say you don’t)',
        paragraphs: [
          'Both are fine — what slows things down is browsing silently for twenty minutes during a rush. If you want to explore, tell the budtender what effect you are after and let them steer. If you researched online and ordered ahead, even better.',
          'Do not ask a budtender to make medical claims. They can share what customers report and what terpene profiles are associated with, but they are not doctors and licensed shops train them not to promise cures.',
        ],
      },
      {
        heading: 'Phones, photos, and cash',
        paragraphs: [
          'Many shops prohibit photos and calls on the sales floor for customer privacy — take conversations outside. Bring cash or expect a debit fee, and count your change at the counter, not after you leave.',
        ],
      },
      {
        heading: 'Tipping',
        paragraphs: [
          'Tipping is optional but common, especially when a budtender spends real time helping you choose. A dollar or two on a quick pickup, or a few dollars on a guided shopping session, is the norm in most markets. Nobody will chase you over it — but it is noticed, and the advice gets even better next visit.',
        ],
      },
      {
        heading: 'Don’t open products in the store — or the car',
        paragraphs: [
          'Sealed packaging must stay sealed until you are home. Opening products on-site is against most shops’ licenses, and open containers in a vehicle are illegal in most states. If something is wrong with a product, bring it back sealed-adjacent with the receipt — licensed shops have return or exchange policies for defective items.',
        ],
      },
    ],
    faq: [
      {
        question: 'Should I tip my budtender?',
        answer:
          'It is optional but appreciated — $1–2 on a quick order, more if they spent time guiding you. Some states technically restrict tip jars, so do not be surprised if a shop politely declines.',
      },
      {
        question: 'Can I bring a friend who is under 21?',
        answer:
          'No. Everyone entering the sales floor must pass the age check, even if they are not buying. Leave under-21 friends (and pets, in most shops) outside.',
      },
    ],
    related: ['first-time-dispensary-visit', 'what-to-bring-to-a-dispensary', 'how-to-order-cannabis-online'],
  },
  {
    slug: 'how-to-get-a-medical-card',
    topic: 'Laws',
    title: 'How to get a medical marijuana card: the process in plain English',
    description:
      'The general steps to getting a medical cannabis card in the U.S. — qualifying conditions, doctor evaluations, state registration, fees, and renewal.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Every medical-cannabis state runs its own program, but the path to a card looks similar almost everywhere: confirm you qualify, get evaluated by a certified clinician, register with the state, and pay a fee. Here is the general shape — always check your own state’s health-department site for the specifics.',
        ],
      },
      {
        heading: '1. Check your state’s qualifying conditions',
        paragraphs: [
          'States publish a list of conditions that qualify for medical cannabis — chronic pain, cancer, epilepsy, PTSD, and multiple sclerosis appear on most lists, and some states let clinicians certify any condition they believe cannabis may help. If your state has adult-use sales too, a card can still be worth it: medical patients often pay lower taxes, get higher possession limits, and access higher-potency products.',
        ],
      },
      {
        heading: '2. Get evaluated by a certified clinician',
        paragraphs: [
          'You need a written certification from a physician or nurse practitioner registered with your state’s program. Many states allow telehealth evaluations, and dedicated evaluation services handle the whole appointment online in 15–30 minutes. Bring medical records that document your condition — some clinicians require them, and they always strengthen the evaluation.',
          'Evaluation fees typically run $50–200 and usually are not covered by insurance, since cannabis remains federally unscheduled for coverage purposes.',
        ],
      },
      {
        heading: '3. Register with the state and pay the fee',
        paragraphs: [
          'With your certification in hand, you create an account on the state registry, upload the certification plus proof of residency, and pay a registration fee (commonly $25–100, often reduced for veterans and low-income patients). Approval ranges from instant to a few weeks; many states issue a temporary digital card immediately.',
        ],
      },
      {
        heading: '4. Shop, then renew',
        paragraphs: [
          'Your card plus photo ID gets you into any medical dispensary in your state. Cards expire — typically every one to two years — and renewal repeats the evaluation and fee. Put the date in your calendar; shopping with an expired card is refused at the door.',
          'On Weedtip, every listing shows whether a shop serves medical patients, recreational customers, or both, so you can filter to shops that honor your card.',
        ],
      },
    ],
    faq: [
      {
        question: 'How much does a medical card cost all-in?',
        answer:
          'Typically $75–300 total: a clinician evaluation ($50–200) plus the state registration fee ($25–100). Renewals cost about the same each cycle. Medical purchase tax savings often repay the cost within a few months for regular patients.',
      },
      {
        question: 'Can I use my medical card in another state?',
        answer:
          'Sometimes. Some states honor out-of-state medical cards ("reciprocity"), others sell to visiting patients through a short registration, and many do not recognize outside cards at all. Check the destination state before traveling — and never carry cannabis across state lines.',
      },
      {
        question: 'Is my medical card information private?',
        answer:
          'State registries are confidential health records, separate from criminal databases. Employers and landlords cannot search them. Note that federal law still treats cannabis use as disqualifying for firearm purchases, which is worth knowing before you register.',
      },
    ],
    related: ['medical-vs-recreational', 'first-time-dispensary-visit', 'can-you-fly-with-weed'],
  },
  {
    slug: 'what-is-dabbing',
    topic: 'Products',
    title: 'What is dabbing? Concentrates, rigs, and why doses are so small',
    description:
      'Dabbing explained for the curious: what a dab is, how rigs and e-rigs work, how strong concentrates are, and how to approach a first dab safely.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'A “dab” is a small dose of cannabis concentrate vaporized on a hot surface and inhaled. Where dried flower typically tests between 15–30% THC, concentrates run 60–90% — which is why dab doses are the size of a grain of rice and why this corner of the menu is best approached with some background knowledge.',
        ],
      },
      {
        heading: 'The hardware: rigs, e-rigs, and dab pens',
        paragraphs: [
          'A traditional dab rig is a small water pipe with a “nail” (usually quartz) that is heated with a torch, then loaded with concentrate. Electronic rigs (e-rigs) and dab pens replace the torch with battery-powered, temperature-controlled heating — a much friendlier starting point, since temperature control is the hardest part of the manual method.',
          'Lower temperatures (roughly 450–550°F) preserve flavor and produce smoother vapor; high temperatures waste terpenes and taste harsh. This is why enthusiasts obsess over timing and quartz thickness.',
        ],
      },
      {
        heading: 'The material: shatter, budder, rosin, and friends',
        paragraphs: [
          'Concentrates differ by texture and extraction method. Shatter is glassy and stable; budder and badder are whipped and creamy; wax is soft and crumbly; live resin is extracted from flash-frozen fresh plants to keep terpene flavor; and rosin is pressed with only heat and pressure — no solvents — which earns it a premium. All of them are used the same way in a rig.',
        ],
      },
      {
        heading: 'Dosing: start absurdly small',
        paragraphs: [
          'A first dab should be tiny — a rice-grain smear, not a pea. Effects hit within seconds and peak fast. Experienced flower smokers are routinely surprised by concentrate potency; there is no prize for starting big, and you can always take a second small dab.',
          'If you are new to cannabis entirely, dabbing is the wrong entry point — start with flower or low-dose edibles and work up.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is dabbing stronger than smoking flower?',
        answer:
          'Per puff, yes — concentrates are typically three to five times more potent than flower by weight, so a small dab can equal several hits of a joint. Dose size is everything.',
      },
      {
        question: 'What is the difference between live resin and rosin?',
        answer:
          'Live resin is solvent-extracted from flash-frozen fresh plants, preserving bright terpene flavor. Rosin is solventless — pressed from flower or hash with heat and pressure. “Live rosin” combines both ideas: solventless pressing of fresh-frozen material, usually the most expensive item in the case.',
      },
    ],
    related: ['cannabis-concentrates-guide', 'what-is-live-resin', 'vaping-vs-smoking'],
    relatedStrains: [],
  },
  {
    slug: 'pre-rolls-guide',
    topic: 'Products',
    title: 'Pre-rolls: what to know before you buy a joint off the shelf',
    description:
      'What is actually inside a pre-roll, how to spot a good one, infused vs regular, and why pre-rolls are the best-selling format for beginners.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'A pre-roll is exactly what it sounds like — a joint rolled for you, sold in a tube. They are the least intimidating item on a dispensary menu: no grinder, no papers, no skill required, and single-unit prices that make trying a new strain cheap. Here is how to buy a good one.',
        ],
      },
      {
        heading: 'What is inside matters most',
        paragraphs: [
          'Pre-rolls are made from full flower buds, “shake” (small pieces that fall off buds in the jar), or trim (leaf material — the lowest grade). Full-flower pre-rolls smoke closest to a hand-rolled joint from bud; shake is a fine budget choice from a reputable brand; trim-heavy pre-rolls burn harsh. Brands that proudly say “whole flower” usually mean it — vague labels usually mean shake.',
        ],
      },
      {
        heading: 'Sizes and formats',
        paragraphs: [
          'Standard sizes are half-gram and full-gram. Multi-packs of mini pre-rolls (often called dogwalkers, ~0.35 g each) are ideal for light users who want one short session without relighting a stale half-joint. Blunts use a thicker wrap and burn longer.',
        ],
      },
      {
        heading: 'Infused pre-rolls are a different animal',
        paragraphs: [
          'An infused pre-roll adds concentrate — kief dusting, distillate coating, or diamonds inside — pushing potency far above regular flower. They are popular and often great value per milligram, but they are NOT beginner products. If you are new, smoke a regular pre-roll; save infused for when you know your tolerance.',
        ],
      },
      {
        heading: 'Freshness checks',
        paragraphs: [
          'Look for a packaged-on date within the last few months, and give the tube a gentle shake — a rock-hard, dried-out pre-roll rattles. Shops with high turnover keep fresher stock, which is one more reason busy dispensaries with good reviews are a safe default.',
        ],
      },
    ],
    faq: [
      {
        question: 'Are pre-rolls weaker than regular flower?',
        answer:
          'Not inherently — a full-flower pre-roll is the same bud you would grind yourself. Budget pre-rolls made from shake or trim can feel weaker or harsher. Check the label’s THC percentage and whether it says whole flower.',
      },
      {
        question: 'How do I keep a half-smoked pre-roll?',
        answer:
          'Stub it out fully, let it cool, and cap it back in its tube. It will taste noticeably worse the next day — which is exactly the problem multi-packs of minis were invented to solve.',
      },
    ],
    related: ['weed-measurements-and-prices', 'how-to-store-cannabis', 'first-time-dispensary-visit'],
  },
  {
    slug: 'tinctures-and-topicals',
    topic: 'Products',
    title: 'Tinctures and topicals: cannabis without the smoke',
    description:
      'How cannabis tinctures and topicals work, how to dose drops under the tongue, and what topicals can (and cannot) do.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'Not everyone wants to inhale, and not every situation calls for an edible. Tinctures and topicals are the quiet corner of the dispensary menu — smoke-free, discreet, and precisely dosable, which makes them favorites among older shoppers and wellness-focused buyers.',
        ],
      },
      {
        heading: 'Tinctures: droppers with precise doses',
        paragraphs: [
          'A tincture is cannabis extract in a carrier oil (usually MCT), sold in a dropper bottle labeled with milligrams of THC and/or CBD per dropper. Held under the tongue for 30–60 seconds, some absorbs directly into the bloodstream, bringing effects on in roughly 15–45 minutes — faster than a swallowed edible, slower than inhaling. Swallowed outright, a tincture behaves like a regular edible.',
          'The dropper is the appeal: doses of 2.5 or 5 mg are easy to measure exactly, and the bottle lasts. Ratio tinctures (like 1:1 or 20:1 CBD:THC) let you choose how intoxicating the experience is — high-CBD ratios are the gentlest introduction to cannabis on the whole menu.',
        ],
      },
      {
        heading: 'Topicals: local, mostly non-intoxicating',
        paragraphs: [
          'Topicals — lotions, balms, roll-ons, and bath soaks — are applied to skin and act locally. Standard topicals do not meaningfully enter the bloodstream, which means they do not get you high, and many users report enjoying them for targeted comfort after workouts or long days. Research on effectiveness is still developing, so treat specific therapeutic claims with healthy skepticism.',
          'The exception is transdermal patches and gels, which are engineered to cross into the bloodstream and CAN be intoxicating — read the label; “transdermal” is the keyword.',
        ],
      },
      {
        heading: 'Buying tips',
        paragraphs: [
          'Check total milligrams per package and per dose, THC:CBD ratio, and the test label like any other product. Start tinctures at 2.5–5 mg THC just as you would an edible, and give each dose a full hour before judging it.',
        ],
      },
    ],
    faq: [
      {
        question: 'Will a topical show up on a drug test?',
        answer:
          'Standard (non-transdermal) topicals are very unlikely to cause a positive test since little to no THC reaches the bloodstream. Transdermal products are designed to enter the bloodstream and can. If testing matters for your job, treat transdermals like any other THC product.',
      },
      {
        question: 'How long does an opened tincture last?',
        answer:
          'Stored cool and dark with the cap tight, most tinctures stay good for a year or more. The oil can slowly lose potency; a changed smell or cloudiness means it is time to replace it.',
      },
    ],
    related: ['edible-dosing-guide', 'understanding-thc-and-cbd', 'how-to-read-cannabis-labels'],
  },
  {
    slug: 'what-is-microdosing',
    topic: 'Body',
    title: 'Microdosing cannabis: less is sometimes the whole point',
    description:
      'What microdosing THC means in practice, typical microdose amounts, which products make it easy, and who tends to prefer it.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'Microdosing means using an amount of THC small enough that you feel a light lift — a little relaxation, a slightly better mood — without feeling high in any way that interferes with your day. It has quietly become one of the most common ways adults use cannabis, and the product shelf has reshaped itself around it.',
        ],
      },
      {
        heading: 'What counts as a microdose',
        paragraphs: [
          'There is no official number, but in practice a THC microdose is 1–2.5 mg — below the 5 mg “standard dose” most states print on edible packaging. Regular users sometimes stretch the definition to 5 mg; genuinely new users can feel 2.5 mg clearly.',
          'The classic protocol is one small dose, wait a full two hours, and only then decide whether a second is worth it. Tolerance builds with daily use, so many microdosers keep a few no-use days per week to keep the small numbers working.',
        ],
      },
      {
        heading: 'The right products for tiny doses',
        paragraphs: [
          'Precision matters more than format. Low-dose gummies and mints scored at 1–2.5 mg, tinctures with graduated droppers, and 5 mg-max beverages make exact dosing trivial. Flower and vapes are harder to microdose — one small puff is a rough approximation at best — though a single gentle draw of a low-THC, high-CBD strain is the smokeable equivalent.',
          'Ratio products shine here: a 1:1 or 2:1 CBD:THC gummy smooths the edges of even a small THC dose, which is exactly what most microdosers are after.',
        ],
      },
      {
        heading: 'Who microdoses, and why',
        paragraphs: [
          'People who want cannabis to fit around their life rather than define the evening: parents after bedtime, professionals unwinding without wine, older adults returning to cannabis after decades away, and creatives chasing a light shift rather than a heavy one. It is also simply the cheapest way to use cannabis — a single 100 mg edible package is forty microdoses.',
        ],
      },
    ],
    faq: [
      {
        question: 'Can you build tolerance from microdosing?',
        answer:
          'Yes, slowly. Daily microdosing still nudges tolerance upward over weeks. Spacing out use — a few cannabis-free days a week — keeps small doses effective, which is the entire economy of microdosing.',
      },
      {
        question: 'Is a microdose detectable on a drug test?',
        answer:
          'Yes. Drug tests detect THC metabolites, not impairment, and even small regular doses accumulate. Microdosing is not a strategy for passing tests.',
      },
    ],
    related: ['edible-dosing-guide', 'understanding-thc-and-cbd', 'tolerance-breaks'],
  },
  {
    slug: 'how-to-sober-up-from-weed',
    topic: 'Body',
    title: 'Too high? How to come down from weed, calmly',
    description:
      'What actually helps when you have taken too much THC — timelines, practical steps, the CBD and peppercorn folklore, and when to seek help.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Almost everyone who uses cannabis eventually overdoes it once — usually with an edible that “wasn’t working” an hour in. The experience can be genuinely unpleasant: racing heart, anxiety, dizziness, waves of paranoia. Here is the honest guide to getting through it, and what the timeline really looks like.',
        ],
      },
      {
        heading: 'First: you are safe, and it will end',
        paragraphs: [
          'There is no documented fatal overdose from cannabis alone. That does not make being too high fun — but it reframes it: this is a wait-it-out situation, not an emergency in itself. Smoked or vaped highs peak within about 30–60 minutes and taper over two to three hours. Edibles are the long haul: peaks one to three hours after onset, with effects that can linger six to eight hours.',
        ],
      },
      {
        heading: 'What actually helps',
        paragraphs: [
          'Move somewhere calm and familiar, dim the stimulation, and put on something comfortingly boring. Sip water, eat something light, and breathe slowly — long exhales specifically signal your nervous system to downshift. If you can nap, sleep is the express lane through an edible high.',
          'Tell someone you trust. Saying “I ate too much of an edible and I am uncomfortable” out loud removes half the fear, and a calm friend is better than any home remedy.',
          'Do not drive, do not take more of anything, and do not add alcohol — it reliably makes THC feel stronger and adds nausea.',
        ],
      },
      {
        heading: 'About CBD, black pepper, and lemon',
        paragraphs: [
          'You will hear that CBD, sniffing black peppercorns, or lemon peel can blunt a THC high. The evidence is thin — some small studies and a lot of anecdotes around CBD and certain terpenes. None of it is harmful to try, and the ritual itself can be calming, but the reliable tools remain time, calm, hydration, and sleep.',
        ],
      },
      {
        heading: 'When to actually seek help',
        paragraphs: [
          'Seek medical attention for chest pain, fainting, repeated vomiting, or symptoms that feel beyond a bad high — and always for children or pets who ingested cannabis (for pets, call a veterinarian immediately). Medical staff have seen THC overconsumption many times; being honest gets you the right care fastest.',
          'Next time: start at 2.5–5 mg with edibles and wait a full two hours before more. Every miserable edible story ever told starts with skipping that rule.',
        ],
      },
    ],
    faq: [
      {
        question: 'How long does being too high last?',
        answer:
          'From smoking or vaping: the worst passes in one to two hours. From edibles: expect four to eight hours with a peak in the middle, occasionally with grogginess the next morning. Sleep through as much of it as you can.',
      },
      {
        question: 'Does CBD really counteract THC?',
        answer:
          'Partially, maybe. Some research suggests CBD can moderate certain THC effects, and many users swear a high-CBD product takes the edge off. Evidence is not strong enough to call it a reliable antidote — think of it as possibly helpful, definitely not harmful.',
      },
    ],
    related: ['edible-dosing-guide', 'how-long-do-edibles-take-to-kick-in', 'what-is-microdosing'],
  },
  {
    slug: 'cannabis-and-sleep',
    topic: 'Body',
    title: 'Cannabis and sleep: what users report, and what science says so far',
    description:
      'Why so many people reach for cannabis at bedtime, which products and cannabinoids are marketed for sleep, and the honest state of the research.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 5,
    body: [
      {
        paragraphs: [
          'Ask dispensary shoppers why they buy, and “sleep” is one of the most common answers. The shelf reflects it: nighttime gummies, CBN blends, and indica labels aimed squarely at 10 p.m. Here is what people report, what products dominate the category, and where the science actually stands — which is more nuanced than the marketing.',
        ],
      },
      {
        heading: 'What users report',
        paragraphs: [
          'Many people say a small THC dose shortens the time it takes to fall asleep and makes it easier to switch off a racing mind. Traditionally indica-labeled strains and products with the terpene myrcene carry the sleepy reputation, though individual response varies enough that personal experimentation beats any label.',
        ],
      },
      {
        heading: 'The sleep shelf: THC, CBN, and CBD',
        paragraphs: [
          'Nighttime edibles typically pair a modest THC dose (2.5–10 mg) with CBN — a mildly psychoactive cannabinoid marketed heavily for sleep despite limited human research — and often CBD to smooth the experience. Fast-acting formats matter at bedtime: tinctures and nano-emulsified gummies come on in well under an hour, where a standard edible might take 90 minutes.',
          'Timing rule of thumb from experienced users: take a sleep edible about an hour before lights out, and keep the dose small — a heavy dose risks grogginess that defeats the purpose.',
        ],
      },
      {
        heading: 'What the research actually says',
        paragraphs: [
          'The honest summary: short-term, low-dose THC appears to help some people fall asleep faster, but research also shows regular heavy use can alter sleep architecture — particularly REM sleep — and stopping after nightly use commonly causes rebound insomnia and vivid dreams for a week or two. Long-term studies are limited, and cannabis is not an approved insomnia treatment.',
          'Persistent insomnia deserves a conversation with a clinician — it is frequently a symptom of something treatable (sleep apnea, anxiety, medication timing) that cannabis would only mask.',
        ],
      },
      {
        heading: 'If you experiment, do it methodically',
        paragraphs: [
          'Change one variable at a time, start at 2.5 mg THC, note results for a week, and keep occasional cannabis-free nights to check you are not just treating rebound. The goal is the smallest dose that helps — not the strongest product on the shelf.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is CBN really “the sleepy cannabinoid”?',
        answer:
          'The marketing is ahead of the evidence. CBN is mildly psychoactive and some small studies and lots of user reports point to sedative effects — often in combination with THC — but rigorous human trials are scarce. Plenty of buyers feel it works; science has not confirmed why or how well.',
      },
      {
        question: 'Will I have trouble sleeping if I stop using cannabis nightly?',
        answer:
          'Very commonly, yes — for a short while. Rebound insomnia and unusually vivid dreams (REM rebound) typically last a few days to two weeks after stopping nightly use, then normalize. It is the most frequently reported quitting symptom.',
      },
    ],
    related: ['what-is-microdosing', 'edible-dosing-guide', 'cbg-cbn-minor-cannabinoids', 'indica-vs-sativa-vs-hybrid'],
    relatedStrains: [
      { name: 'Granddaddy Purple', slug: 'granddaddy-purple' },
      { name: 'Northern Lights', slug: 'northern-lights' },
    ],
  },
  {
    slug: 'thc-percentage-explained',
    topic: 'Plant',
    title: 'THC percentage explained: what counts as strong — and why the number lies',
    description:
      'What THC % on a label really measures, typical ranges for flower and concentrates, and why potency is a poor proxy for quality.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'The THC percentage is the most-read number on any cannabis label — and the most misunderstood. It tells you concentration, not experience, and chasing the biggest number is the most common rookie buying mistake. Here is how to read it like a budtender.',
        ],
      },
      {
        heading: 'Typical ranges',
        paragraphs: [
          'Modern dispensary flower mostly tests between 15% and 30% THC. Under 15% is mild by today’s standards (and often deliberately so — great for daytime or beginners); 18–24% is the broad middle of the market; above 28% is the marketing-driven top shelf. Vape oils typically run 70–90%, and concentrates 60–90% — which is why their doses are measured in rice grains, not grams.',
          'On labels you will see “Total THC,” which combines the small amount of active THC with THCA — the raw acid form that converts to THC when heated. Total THC is the number that matters for smoked or vaped products.',
        ],
      },
      {
        heading: 'Why the biggest number is not the best buy',
        paragraphs: [
          'Perceived strength depends on dose, tolerance, terpenes, and cannabinoid balance — not percentage alone. A 19% flower rich in terpenes can feel more powerful and more pleasant than a bland 30% cut, the same way a strong espresso beats a bigger cup of weak coffee. Researchers consistently find THC % is a weak predictor of reported experience.',
          'There is also grade inflation: labs vary, and shelf pressure rewards high numbers. Treat an eye-popping percentage with the same skepticism as a too-good review score, and weight terpene content (anything above ~2% total terpenes is aromatic, flavorful flower) at least as heavily.',
        ],
      },
      {
        heading: 'Match potency to purpose',
        paragraphs: [
          'Social evening with friends: mid-teens to low-twenties is plenty. Deep couch night for a heavy tolerance: the top shelf exists for a reason. New or returning after years away: start under 18% — or with a 5 mg edible where the dose is printed on the piece. The right number is the one that fits the night, not the biggest one in the case.',
        ],
      },
    ],
    faq: [
      {
        question: 'What THC percentage is considered strong?',
        answer:
          'For flower, above roughly 25% is strong by any standard; 18–24% is normal modern potency. For context, average flower in the 1990s tested under 10% — today’s “mild” is yesterday’s strong.',
      },
      {
        question: 'What is the difference between THC and THCA?',
        answer:
          'THCA is the non-intoxicating acid form in the raw plant; heat (smoking, vaping, baking) converts it to active THC. “Total THC” on labels estimates the combined potency after that conversion.',
      },
    ],
    related: ['how-to-read-cannabis-labels', 'what-are-terpenes', 'understanding-thc-and-cbd', 'what-is-thca'],
  },
  {
    slug: 'decarboxylation-explained',
    topic: 'Plant',
    title: 'Decarboxylation: why raw weed doesn’t work and heat changes everything',
    description:
      'The chemistry that turns THCA into THC — why edibles need baked flower, what temperatures work, and how decarbing happens automatically when you smoke.',
    datePublished: '2026-07-19',
    dateModified: '2026-07-19',
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          'Eat a raw cannabis bud and almost nothing happens. That is not a myth — it is chemistry. The plant does not make THC directly; it makes THCA, a non-intoxicating precursor that only becomes THC when heated. That conversion is called decarboxylation (“decarbing”), and it is the invisible step behind every working edible, joint, and vape.',
        ],
      },
      {
        heading: 'The chemistry, in one paragraph',
        paragraphs: [
          'Heat knocks a carboxyl group off the THCA molecule (releasing carbon dioxide), reshaping it into THC — the form that fits the receptors in your nervous system. The same applies to CBDA converting to CBD. When you smoke or vape, the flame or coil decarbs the flower instantly at the moment of use; nothing extra is needed.',
        ],
      },
      {
        heading: 'Why edibles are different',
        paragraphs: [
          'Cooking with cannabis means the decarb has to happen deliberately, before or during infusion. Home cooks bake ground flower low and slow — commonly around 230–250°F (110–120°C) for 30–45 minutes — because THC converts efficiently below the temperature where it starts degrading and terpenes boil away. Skipping this step is the classic reason homemade edibles “don’t work.”',
          'Dispensary edibles and tinctures are made from already-activated extract, which is why their labels state ready-to-go THC milligrams. Products labeled THCA — raw diamonds, some flower figures — state potential potency that only applies once heated.',
        ],
      },
      {
        heading: 'Where you will see this on labels',
        paragraphs: [
          '“Total THC” on flower labels is a formula combining the trace of active THC with the THCA that will convert when you light it. Understanding decarb is also the key to the hemp-market “THCA flower” loophole you may have seen online: chemically, it becomes ordinary THC the moment it burns.',
        ],
      },
    ],
    faq: [
      {
        question: 'Can eating raw cannabis get you high?',
        answer:
          'Essentially no — raw plant contains THCA, not THC. Some people juice raw cannabis for other reasons, but intoxication requires heat-activated THC.',
      },
      {
        question: 'What temperature decarboxylates cannabis?',
        answer:
          'Conversion happens meaningfully from about 220°F and is commonly done at 230–250°F (110–120°C) for 30–45 minutes for home cooking. Hotter is not better: THC itself degrades and terpenes evaporate well before oven-roasting temperatures.',
      },
    ],
    related: ['what-is-thca', 'edible-dosing-guide', 'thc-percentage-explained'],
  },
];
