// Neon Bay — pure story + world data. No imports, no network, no external assets.
// All names, places and story beats are original.
export const STORY_MISSIONS = [
  // ---- District 0: Downtown (ids 1-20) — Leo Vance arrives broke ----
  { id: 1, district: 0, title: 'Bus Stop Broke', brief: 'Leo steps off the night bus with two duffel bags and forty dollars. His old friend Maya is waiting by the Neon Diner with a lead — reach the diner and ask Rico for work.', type: 'goto', x: 1800, y: 2558, reward: 100, enemies: 0 },
  { id: 2, district: 0, title: 'First Shift at the Diner', brief: 'Rico hires Leo on the spot if he can handle the lunch rush. Talk to Rico behind the counter and take the job.', type: 'talk', x: 1800, y: 2558, reward: 140, enemies: 0 },
  { id: 3, district: 0, title: 'Noodles for Mrs. Okafor', brief: 'A regular customer ordered takeout across town and the delivery scooter is in the shop. Carry her noodles to City Park before they go cold.', type: 'deliver', x: 2742, y: 3150, reward: 160, enemies: 0 },
  { id: 4, district: 0, title: 'The Rent Man Cometh', brief: 'A landlord’s collector is leaning on Rico for back rent the diner never owed. Drive Rico’s old sedan to the corner office and settle the books in person.', type: 'drive', x: 4400, y: 2108, reward: 200, enemies: 0 },
  { id: 5, district: 0, title: 'Vulture Feathers', brief: 'The Vulture gang has started tagging every shutter on Neon Row. Maya tipped Leo off about their spray cans — collect the stash they hid behind the arcade.', type: 'collect', x: 3400, y: 1742, reward: 220, enemies: 0 },
  { id: 6, district: 0, title: 'A Word With Kestrel', brief: 'Kestrel, the Vultures’ loudmouth lieutenant, is drinking at the Rusty Anchor. Walk in, sit down, and make it clear the diner is off limits.', type: 'talk', x: 2000, y: 3908, reward: 260, enemies: 0 },
  { id: 7, district: 0, title: 'Chase the Tagger', brief: 'A Vulture tagger just defaced the diner’s new sign and bolted on a scooter. Run him down through the side streets before he reaches the underpass.', type: 'chase', x: 4800, y: 2642, reward: 300, enemies: 2 },
  { id: 8, district: 0, title: 'The Alley Standoff', brief: 'Three Vultures cornered a delivery driver behind the market and took his cash box. Take the box back and make sure they remember who did it.', type: 'eliminate', x: 2500, y: 4358, reward: 340, enemies: 3 },
  { id: 9, district: 0, title: 'Hot Wheels, Cold Cash', brief: 'Rico’s cousin needs a car moved from Turbo Works to the safe house garage without the cops noticing the fresh paint job. Drive it clean and quiet.', type: 'drive', x: 495, y: 1610, reward: 380, enemies: 0 },
  { id: 10, district: 0, title: 'Neon Row Midnight Race', brief: 'A street racer named Jax bets his pink slip that no diner kid can beat him down Neon Row. Prove him wrong at the midnight starting line.', type: 'race', x: 3800, y: 3008, reward: 450, enemies: 0 },
  { id: 11, district: 0, title: 'Rico’s Old Debt', brief: 'A loan shark from the old neighborhood has come to collect a debt Rico thought was buried. Deliver the envelope to the shark’s man at the Cue Club.', type: 'deliver', x: 3000, y: 2642, reward: 480, enemies: 0 },
  { id: 12, district: 0, title: 'The Informant on Fifth', brief: 'A nervous bookkeeper will trade the Vultures’ turf map for safe passage out of the district. Meet him on Fifth and walk him to the taxi stand.', type: 'talk', x: 1600, y: 1658, reward: 520, enemies: 0 },
  { id: 13, district: 0, title: 'Warehouse of Feathers', brief: 'The turf map points to a Vulture stash house full of stolen electronics. Clear the guards and haul the crates out for Rico’s fence.', type: 'eliminate', x: 5142, y: 5100, reward: 580, enemies: 4 },
  { id: 14, district: 0, title: 'Smoke Over the Market', brief: 'The Vultures torched a market stall to scare the shopkeepers into paying protection. Survive the ambush they left waiting in the smoke and save the stall.', type: 'survive', x: 3000, y: 3542, reward: 640, enemies: 4 },
  { id: 15, district: 0, title: 'The Getaway Driver Audition', brief: 'A fixer called Delia needs a driver who can lose a tail in downtown traffic. Take her sedan through the checkpoint course and shake the pursuit car.', type: 'chase', x: 5400, y: 1742, reward: 700, enemies: 2 },
  { id: 16, district: 0, title: 'Vulture Nest', brief: 'Leo has the whole Vulture roster now. Hit their clubhouse on the east edge of downtown and drive the gang out of the district for good.', type: 'eliminate', x: 5800, y: 3458, reward: 780, enemies: 4 },
  { id: 17, district: 0, title: 'Crown of Neon Row', brief: 'With the Vultures gone, every small crew on Neon Row wants a piece of the turf. Race the circuit and plant the crew’s flag at all three checkpoints.', type: 'race', x: 2142, y: 4950, reward: 850, enemies: 0 },
  { id: 18, district: 0, title: 'Rico’s Confession', brief: 'Rico finally admits the diner’s deed is held by an airport cargo boss. Meet Rico at the diner after closing and hear the plan to steal it back.', type: 'talk', x: 1800, y: 2558, reward: 900, enemies: 0 },
  { id: 19, district: 0, title: 'Tools of the Trade', brief: 'The heist needs a runway truck, a forged manifest, and a distraction at the cargo gate. Collect the three pieces stashed around downtown before dawn.', type: 'collect', x: 3600, y: 4808, reward: 1000, enemies: 0 },
  { id: 20, district: 0, title: 'The Cargo Heist', brief: 'Everything rides on one runway run: storm the airport cargo terminal, load the deed crate onto the truck, and tear down the runway while security gives chase. Pull it off and the road to Sunset Beach opens.', type: 'drive', x: 4650, y: 4710, reward: 1200, enemies: 0 },

  // ---- District 1: Sunset Beach (ids 21-40) — smuggling, races, casino ----
  { id: 21, district: 1, title: 'Salt in the Air', brief: 'Leo rolls onto the boardwalk with the deed in hand and salt on the wind. Reach the Beach Shack and meet the smuggler who runs the pier.', type: 'goto', x: 7158, y: 3000, reward: 1250, enemies: 0 },
  { id: 22, district: 1, title: 'The Pier Broker', brief: 'Captain Solana moves anything that floats, for a price. Talk her into lending the crew a boat for the night run.', type: 'talk', x: 8042, y: 3300, reward: 1300, enemies: 0 },
  { id: 23, district: 1, title: 'First Night Run', brief: 'A sealed crate needs to cross the bay under cover of dark. Pilot the boat out past the pier lights and deliver it to the old lighthouse cove.', type: 'deliver', x: 8700, y: 1958, reward: 1350, enemies: 0 },
  { id: 24, district: 1, title: 'Boardwalk Sprint', brief: 'Beach racers mock the downtown crew’s cars as city toys. Settle it with a sprint down the boardwalk at sunset.', type: 'race', x: 7600, y: 2042, reward: 1400, enemies: 0 },
  { id: 25, district: 1, title: 'Tide Pool Pickups', brief: 'A tide-pool collector lost his specimen crates along the shore when the tide turned. Gather them before the waves take them out.', type: 'collect', x: 8500, y: 3958, reward: 1450, enemies: 0 },
  { id: 26, district: 1, title: 'The Lifeguard’s Favor', brief: 'The head lifeguard’s brother is in debt to the boardwalk bookies. Talk the bookies down at their stall before the debt doubles at midnight.', type: 'talk', x: 7958, y: 2700, reward: 1500, enemies: 0 },
  { id: 27, district: 1, title: 'Harbor Rats', brief: 'A rival smuggling crew is hijacking Solana’s night runs. Chase their skiff back toward the harbor and run it aground.', type: 'chase', x: 8400, y: 4958, reward: 1580, enemies: 2 },
  { id: 28, district: 1, title: 'The Sunken Ledger', brief: 'A waterproof ledger with every harbor payoff sits in a wreck off Pier 9. Swim out, grab it, and bring it back before the harbor rats find it first.', type: 'collect', x: 9350, y: 2642, reward: 1650, enemies: 0 },
  { id: 29, district: 1, title: 'Casino Courier', brief: 'A boardwalk casino host needs a velvet bag carried from the Beach Shack to the casino floor without anyone peeking inside. Deliver it and keep your mouth shut.', type: 'deliver', x: 8042, y: 1650, reward: 1720, enemies: 0 },
  { id: 30, district: 1, title: 'High Roller Distraction', brief: 'While the crew cases the casino vault, Leo has to keep the pit boss talking at the roulette table. Hold his attention until the signal.', type: 'talk', x: 8042, y: 1650, reward: 1800, enemies: 0 },
  { id: 31, district: 1, title: 'Jet Ski Ambush', brief: 'The harbor rats set a trap at the swim buoy line and opened fire on Solana’s boat. Clear them out and tow the boat back to the pier.', type: 'eliminate', x: 8758, y: 3600, reward: 1880, enemies: 3 },
  { id: 32, district: 1, title: 'The Longest Night', brief: 'Three smuggling runs in one night, each hotter than the last, with harbor patrol sweeping the bay. Survive the night and bring every crate home.', type: 'survive', x: 8200, y: 4358, reward: 1950, enemies: 4 },
  { id: 33, district: 1, title: 'Beach Guns Blazing', brief: 'A beach gang torched Solana’s storage shed to send a message. Take the fight to their stash house behind the gun shop and end the feud.', type: 'eliminate', x: 6700, y: 4042, reward: 2020, enemies: 4 },
  { id: 34, district: 1, title: 'Sunset Grand Prix', brief: 'The whole beach turns out for the Sunset Grand Prix, a three-lap blast around the shore road. Win it and the crew’s name is painted on the pier.', type: 'race', x: 7800, y: 4442, reward: 2100, enemies: 0 },
  { id: 35, district: 1, title: 'The Croupier’s Secret', brief: 'A casino croupier is skimming chips and wants out before security notices. Escort his evidence to Solana’s boat without the floor guards spotting the handoff.', type: 'drive', x: 8042, y: 3300, reward: 2180, enemies: 0 },
  { id: 36, district: 1, title: 'Storm Surge Run', brief: 'A storm is rolling in and the last crate of the season has to move tonight. Drive the truck through the flooded shore road to the lighthouse before the waves close it.', type: 'drive', x: 8700, y: 1958, reward: 2260, enemies: 0 },
  { id: 37, district: 1, title: 'The Boardwalk King', brief: 'The boardwalk bookies’ enforcer has been shaking down every stall since the casino job. Run him down on his own turf and take back the stall money.', type: 'chase', x: 7242, y: 3600, reward: 2350, enemies: 3 },
  { id: 38, district: 1, title: 'Vault Blueprints', brief: 'The casino vault’s blueprints are split across three safety deposit boxes along the boardwalk. Collect every page before the security rotation changes.', type: 'collect', x: 7958, y: 2400, reward: 2440, enemies: 0 },
  { id: 39, district: 1, title: 'Solana’s Farewell', brief: 'Solana is retiring to the north and leaves the crew her fastest boat — if they can outrun her old crew one last time along the coast. Say goodbye in style.', type: 'race', x: 8758, y: 1650, reward: 2550, enemies: 0 },
  { id: 40, district: 1, title: 'The Boardwalk Casino Job', brief: 'The vault, the crew, the boat, the storm — everything converges on one night. Crack the boardwalk casino vault, load the take onto Solana’s boat, and vanish into the dark. The haul buys the road into Cinder Peaks.', type: 'eliminate', x: 8042, y: 1650, reward: 2700, enemies: 4 },

  // ---- District 2: Cinder Peaks (ids 41-60) — mountain gang war, lodge showdown ----
  { id: 41, district: 2, title: 'Thin Air', brief: 'The mountain road climbs past the tree line into Cinder Peaks, where the air is thin and the welcome is thinner. Reach the Peak Lodge Cafe and find a friendly face.', type: 'goto', x: 4800, y: 492, reward: 2750, enemies: 0 },
  { id: 42, district: 2, title: 'The Lodge Keeper', brief: 'Old Bram runs the lodge and knows every gang in the peaks by their tire tracks. Talk him into pointing the crew at the mountain gang’s supply line.', type: 'talk', x: 4800, y: 492, reward: 2780, enemies: 0 },
  { id: 43, district: 2, title: 'Supply Line Snow Job', brief: 'The mountain gang’s supply truck crawls the pass every evening. Intercept the route and deliver the stolen medical crates to the lodge instead.', type: 'deliver', x: 2400, y: 858, reward: 2800, enemies: 0 },
  { id: 44, district: 2, title: 'Avalanche Alley', brief: 'A rival crew set charges above the pass to bury the crew’s truck. Race the falling snow down Avalanche Alley before the road disappears.', type: 'race', x: 1600, y: 408, reward: 2820, enemies: 0 },
  { id: 45, district: 2, title: 'The Frozen Cache', brief: 'A smuggler’s cache froze solid in a drift near the lake shore years ago. Dig out the marked crates before the thaw buries them for good.', type: 'collect', x: 6200, y: 858, reward: 2840, enemies: 0 },
  { id: 46, district: 2, title: 'Ski Patrol Plea', brief: 'The ski patrol lost a radio relay in the storm and a stranded skier is waiting on the slope. Talk to the patrol chief and take the relay job.', type: 'talk', x: 3558, y: 300, reward: 2860, enemies: 0 },
  { id: 47, district: 2, title: 'Ridge Runners', brief: 'Mountain gang scouts on snow bikes are circling the lodge to cut its power. Chase them off the ridge before the lights go out.', type: 'chase', x: 5800, y: 942, reward: 2880, enemies: 2 },
  { id: 48, district: 2, title: 'The Cabin Standoff', brief: 'Gang enforcers took over a mountain cabin and are holding the lodge’s cook hostage. Clear the cabin and bring the cook home.', type: 'eliminate', x: 8400, y: 858, reward: 2900, enemies: 3 },
  { id: 49, district: 2, title: 'Lake Ice Delivery', brief: 'A fisherman’s hut on the far shore needs fuel before the lake ice locks the road. Drive the careful route around the frozen lake and deliver it.', type: 'deliver', x: 8800, y: 408, reward: 2920, enemies: 0 },
  { id: 50, district: 2, title: 'The Chairlift Gambit', brief: 'The gang cut the chairlift cables to strand the lodge’s guests mid-slope. Climb to the lift station and hold the platform until the engineers finish the repair.', type: 'survive', x: 3000, y: 858, reward: 2940, enemies: 4 },
  { id: 51, district: 2, title: 'Snowblind Pursuit', brief: 'A gang courier with the lodge’s stolen payroll is fleeing toward the north pass in a whiteout. Run him down before he crosses the ridge.', type: 'chase', x: 9000, y: 942, reward: 2950, enemies: 3 },
  { id: 52, district: 2, title: 'The Hermit’s Map', brief: 'A hermit living above the lake claims to know where the gang hides its war chest. Find his hut, hear him out, and take the map he offers.', type: 'talk', x: 7200, y: 942, reward: 2960, enemies: 0 },
  { id: 53, district: 2, title: 'War Chest Fragments', brief: 'The hermit’s map marks four buried caches scattered across the peaks. Dig up every fragment of the war chest before the gang’s patrols find them.', type: 'collect', x: 4458, y: 225, reward: 2970, enemies: 0 },
  { id: 54, district: 2, title: 'The Pass Blockade', brief: 'The mountain gang has blockaded the only pass out of the peaks with trucks and riflemen. Break the blockade and open the road.', type: 'eliminate', x: 2000, y: 942, reward: 2980, enemies: 4 },
  { id: 55, district: 2, title: 'Blizzard Holdout', brief: 'A blizzard traps the crew at the lodge with gang shooters closing in through the snow. Hold the lodge doors until dawn breaks the storm.', type: 'survive', x: 4800, y: 492, reward: 2990, enemies: 4 },
  { id: 56, district: 2, title: 'The Summit Race', brief: 'To prove the crew owns the peaks, Leo challenges the gang’s best driver to a climb from the lodge to the summit beacon. Win the mountain.', type: 'race', x: 5200, y: 408, reward: 2995, enemies: 0 },
  { id: 57, district: 2, title: 'Smoke Signals', brief: 'The gang’s lookout network is strung across the ridges with signal fires. Drive the ridge road and douse every fire before the final push.', type: 'drive', x: 6600, y: 942, reward: 3000, enemies: 0 },
  { id: 58, district: 2, title: 'The Traitor’s Confession', brief: 'A gang lieutenant captured at the blockade wants to trade the lodge vault’s combination for a clean getaway. Hear him out at the old chapel.', type: 'talk', x: 1200, y: 492, reward: 3000, enemies: 0 },
  { id: 59, district: 2, title: 'The Long Climb', brief: 'One last supply run up the summit road in the dark: medicine, fuel, and the vault charges, all riding in one truck the gang will try to stop.', type: 'deliver', x: 5200, y: 408, reward: 3000, enemies: 0 },
  { id: 60, district: 2, title: 'The Peak Lodge Score', brief: 'The mountain gang’s entire fortune sits in the vault beneath the peak lodge. Crack it, load the take, and fight your way down the summit as every gang in the peaks comes for you. Leo came to Neon Bay broke — tonight he leaves as a legend.', type: 'eliminate', x: 5200, y: 408, reward: 3000, enemies: 4 },
];

export const SIDE_QUEST_TEMPLATES = [
  { type: 'deliver', title: 'Hot Delivery to {place}', brief: '{person} needs a package rushed to {place} before it cools down. Carry it there and don’t stop for anything.', baseReward: 120 },
  { type: 'taxi', title: 'Cab Fare: {person} to {place}', brief: '{person} is in a hurry and will pay well for a fast, smooth ride to {place}. Mind the traffic.', baseReward: 100 },
  { type: 'photo', title: 'Postcard Shot at {place}', brief: '{person} wants the perfect photo of {place} for a travel blog. Get to the spot and snap it at golden hour.', baseReward: 90 },
  { type: 'fight', title: 'Trouble at {place}', brief: 'Some thugs are shaking down the regulars near {place} and {person} wants them taught a lesson. Handle it.', baseReward: 180 },
  { type: 'race', title: 'Street Challenge at {place}', brief: '{person} swears nobody can beat their time around {place}. Prove them wrong and take the prize.', baseReward: 160 },
  { type: 'fetch', title: 'Fetch It From {place}', brief: '{person} left something valuable at {place} and can’t go back for it. Bring it to them in one piece.', baseReward: 110 },
  { type: 'escort', title: 'Walk {person} to {place}', brief: '{person} needs a safe escort to {place} after dark. Stay close and watch the alleys.', baseReward: 150 },
  { type: 'collect', title: 'Lost and Found at {place}', brief: '{person} scattered their keepsakes all over {place} in the wind. Gather every last one.', baseReward: 130 },
  { type: 'deliver', title: 'Midnight Parcel for {place}', brief: '{person} has a parcel that must reach {place} by midnight, no questions asked. Deliver it quietly.', baseReward: 140 },
  { type: 'taxi', title: 'Airport Run for {person}', brief: '{person} is late for a flight and needs a driver who knows every shortcut to {place}. Floor it, carefully.', baseReward: 130 },
  { type: 'photo', title: 'Sunset Shoot With {person}', brief: '{person} is a photographer chasing the last light at {place}. Guide them to the best vantage point.', baseReward: 100 },
  { type: 'fight', title: 'Bar Brawl Backup at {place}', brief: '{person} got into it with the wrong crowd at {place} and needs backup fast. Even the odds.', baseReward: 200 },
];

export const SIDE_QUEST_PLACES = [
  { name: 'Neon Diner', x: 1800, y: 2558 },
  { name: 'Pier 9', x: 9050, y: 2642 },
  { name: 'Peak Lodge', x: 4800, y: 492 },
  { name: 'Boardwalk', x: 7600, y: 2042 },
  { name: 'Turbo Works', x: 3600, y: 4808 },
  { name: 'City Park', x: 2742, y: 3150 },
  { name: 'Old Lighthouse', x: 8700, y: 1958 },
  { name: 'Mountain Cabin', x: 8400, y: 858 },
  { name: 'Cue Club', x: 3000, y: 2642 },
  { name: 'The Rusty Anchor', x: 2000, y: 3908 },
  { name: 'Velvet Thread', x: 2400, y: 2108 },
  { name: 'Ironworks Arms', x: 1200, y: 3458 },
  { name: 'Sunset Greens', x: 7800, y: 4442 },
  { name: 'Beach Shack', x: 7158, y: 3000 },
  { name: 'Neon Row Arcade', x: 3400, y: 1742 },
  { name: 'Harbor Market', x: 8200, y: 4358 },
  { name: 'Ski Lodge', x: 3558, y: 300 },
  { name: 'Lakeview Hut', x: 8800, y: 408 },
  { name: 'Airport Terminal', x: 4700, y: 4442 },
  { name: 'Iron Paradise Gym', x: 3258, y: 1800 },
  { name: 'Boardwalk Casino', x: 8042, y: 1650 },
  { name: 'Summit Beacon', x: 5200, y: 408 },
  { name: 'Fifth Street Books', x: 1600, y: 1658 },
  { name: 'Marina Office', x: 8042, y: 3300 },
];

export const SIDE_QUEST_GIVERS = [
  'Rosa Delgado', 'Marcus Bell', 'Priya Nair', 'Tommy Kowalski', 'Aisha Bello',
  'Diego Fuentes', 'Hana Sato', 'Omar Haddad', 'Greta Lindqvist', 'Felix Romero',
  'Nadia Petrova', 'Sam Whitaker', 'Lena Fischer', 'Carlos Mendez', 'Yuki Tanaka',
  'Vera Kovalenko', 'Andre Boateng', 'Molly O’Connor', 'Ravi Sharma', 'Elena Rossi',
  'Jack Holloway', 'Sofia Almeida', 'Ben Osei', 'Clara Dubois', 'Ivan Sokolov',
  'Mia Chen', 'Leo Park', 'Nina Volkov', 'Owen Gallagher', 'Tara Singh',
];

export function generateSideQuest(rng, id) {
  const template = rng.pick(SIDE_QUEST_TEMPLATES);
  const place = rng.pick(SIDE_QUEST_PLACES);
  const giver = rng.pick(SIDE_QUEST_GIVERS);
  const title = template.title.replaceAll('{place}', place.name).replaceAll('{person}', giver);
  const brief = template.brief.replaceAll('{place}', place.name).replaceAll('{person}', giver);
  const multipliers = { deliver: 1.0, taxi: 0.9, photo: 0.8, fight: 1.5, race: 1.3, fetch: 0.9, escort: 1.2, collect: 1.0 };
  const mult = multipliers[template.type] || 1.0;
  const reward = Math.max(40, Math.min(400, Math.round(template.baseReward * mult * rng.range(0.85, 1.25))));
  return { id, title, giver, type: template.type, x: place.x, y: place.y, reward, brief };
}

export const NPC_NAMES = [
  'Walter Grimm', 'Beatrice Lane', 'Hugo Ferreira', 'Dana Whitfield', 'Kofi Mensah',
  'Ingrid Halvorsen', 'Pablo Serrano', 'Farah Aziz', 'Gus Callahan', 'Mira Johansson',
  'Theo Marchetti', 'Zara Ahmed', 'Cole Bennett', 'Ana Duarte', 'Victor Hale',
  'June Park', 'Rafael Ortiz', 'Elsa Bergström', 'Dmitri Volkov', 'Lila Moreau',
  'Samir Patel', 'Holly Brennan', 'Ethan Cross', 'Noor Alami', 'Silas Reed',
  'Carmen Vega', 'Otto Wagner', 'Tessa Novak', 'Jamal Carter', 'Freya Nilsen',
  'Andres Luna', 'Grace Kim', 'Nikolai Petrov', 'Ruth Adler', 'Marco Silva',
  'Iris Tanaka', 'Calvin Moss', 'Petra Novak', 'Diego Salazar', 'Willa Ford',
  'Emre Demir', 'Sana Iqbal', 'Rory McAllister', 'Bianca Costa', 'Henrik Larsen',
];

// Maya Reyes — Leo's friend by the Neon Diner. She knows the streets and
// always has a lead; talking to her never costs anything but a minute.
export const MAYA_LINES = [
  'Leo! You made it off that bus. Rico’s been asking about you — go talk to him, he’s got work.',
  'The Vultures tagged the arcade again last night. Their stash is behind it, if you’re feeling brave.',
  'Word is the beach gate only opens for whoever pulls the airport job. That’s Rico’s plan, not mine.',
  'I heard the casino vault job needs a driver who can keep a pit boss talking. That sounds like you.',
  'Take care of yourself out there. This city eats people who rush in alone — and you’re alone now.',
  'If you need cash fast, there’s always side work. Ask around — somebody always knows something.',
];

export const DIALOGUE_GREETINGS = [  'Hey, watch the traffic out there.',
  'Neon Bay never sleeps, kid.',
  'You look new around here. Stay sharp.',
  'Beautiful day, if you ignore the sirens.',
  'I saw the whole thing. Ask me anything.',
  'The beach is that way. The trouble is everywhere.',
  'Nice ride. Don’t scratch it on my street.',
  'Rico’s diner does the best noodles in town.',
  'Careful up in the peaks — the roads bite back.',
  'You heading to the boardwalk? Take the shore road.',
  'I heard the casino’s got new security tonight.',
  'If you need work, ask around the market.',
  'The lighthouse light still works, you know.',
  'Don’t feed the gulls. They remember faces.',
];

export const DIALOGUE_TIPS = [
  'Eat at a diner to heal up before a fight.',
  'Your car heals at the garage. Use it.',
  'Wanted stars fade if you stay out of sight.',
  'Better guns cost more, but they end fights faster.',
  'Save your money — the bazooka is worth it.',
  'Swim slow near the pier or the current takes you.',
  'A fast car beats a fast gun in a chase.',
  'Check the map: gold markers are your next job.',
  'Clothes don’t change your armor, just your look.',
  'Talk to everyone. Somebody always knows something.',
  'Races pay best if you cut the corners clean.',
  'Keep an eye on the clock — nights get rough.',
];

export const SHOP_DEFS = [
  { id: 'diner', kind: 'food', name: 'Neon Diner', x: 1800, y: 2558 },
  { id: 'beach-shack', kind: 'food', name: 'Beach Shack', x: 7158, y: 3000 },
  { id: 'lodge-cafe', kind: 'food', name: 'Peak Lodge Cafe', x: 4800, y: 492 },
  { id: 'ironworks', kind: 'gun', name: 'Ironworks Arms', x: 1200, y: 3458 },
  { id: 'beach-guns', kind: 'gun', name: 'Beach Guns', x: 6700, y: 4042 },
  { id: 'velvet-thread', kind: 'clothes', name: 'Velvet Thread', x: 2400, y: 2108 },
  { id: 'boardwalk-style', kind: 'clothes', name: 'Boardwalk Style', x: 7600, y: 2042 },
  { id: 'turbo-works', kind: 'mods', name: 'Turbo Works', x: 3600, y: 4808 },
];

export const ACTIVITY_SPOTS = [
  { kind: 'pool', name: 'Cue Club', x: 3000, y: 2642 },
  { kind: 'golf', name: 'Sunset Greens', x: 7800, y: 4442 },
  { kind: 'race', name: 'Airport Drag Strip', x: 4700, y: 4442 },
  { kind: 'swim', name: 'Pier 9 Swim', x: 9050, y: 2642 },
  { kind: 'darts', name: 'The Rusty Anchor', x: 2000, y: 3908 },
  { kind: 'gym', name: 'Iron Paradise', x: 3258, y: 1800 },
];

export const WEAPON_SHOP_STOCK = ['rifle', 'shotgun', 'melee', 'grenade', 'bazooka'];

// Sky + lighting palettes for the 3D renderer (weather.js picks one by
// time of day and rain). Hex strings so both THREE colours and CSS can use them.
export const SKY_COLORS = {
  day: { sky: '#87ceeb', fog: '#bcd8e8', horizon: '#cfe8f5', sun: '#fff3b0', ambient: '#ffffff', hemiSky: '#bcd8ff', hemiGround: '#4a5240' },
  dusk: { sky: '#e8907c', fog: '#d9a08c', horizon: '#f7c873', sun: '#ff9a3d', ambient: '#ffb38a', hemiSky: '#e8a87c', hemiGround: '#3a3230' },
  night: { sky: '#0b1026', fog: '#131a33', horizon: '#1a2340', sun: '#e2e8f0', ambient: '#8fa3c7', hemiSky: '#25304f', hemiGround: '#0c0f16' },
  rain: { sky: '#5b6b7a', fog: '#6b7a80', horizon: '#8a9aa0', sun: '#cfd8dc', ambient: '#b0bec5', hemiSky: '#7a8a94', hemiGround: '#2e3438' },
};

// Mountain peaks of Cinder Peaks (district 2, y < 900) for the 3D terrain
// (world.js): x/y are world coords, height is the peak height in world
// units, radius the base radius. Kept clear of the lake (x 3300-4000, y 60-380).
export const MOUNTAIN_PEAKS = [
  { x: 1200, y: 375, height: 312, radius: 544 },
  { x: 3000, y: 180, height: 396, radius: 646 },
  { x: 5200, y: 135, height: 468, radius: 714 },
  { x: 6800, y: 975, height: 360, radius: 578 },
  { x: 8600, y: 270, height: 420, radius: 612 },
  { x: 4400, y: 840, height: 264, radius: 510 },
  { x: 1800, y: 1050, height: 240, radius: 476 },
];
