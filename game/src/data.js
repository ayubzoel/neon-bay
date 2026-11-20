// Neon Bay — story + world data. No network, no external assets (the i18n
// import below is a local module). All names, places and story beats are original.
import { addStrings, t } from './i18n.js';
export const STORY_MISSIONS = [
  // ---- District 0: Downtown (ids 1-20) — Leo Vance arrives broke ----
  { id: 1, key: 'mission.1', district: 0, title: 'Bus Stop Broke', brief: 'Leo steps off the night bus with two duffel bags and forty dollars. His old friend Maya is waiting by the Neon Diner with a lead — reach the diner and ask Rico for work.', type: 'goto', x: 450, y: 852.7, reward: 100, enemies: 0 },
  { id: 2, key: 'mission.2', district: 0, title: 'First Shift at the Diner', brief: 'Rico hires Leo on the spot if he can handle the lunch rush. Talk to Rico behind the counter and take the job.', type: 'talk', x: 450, y: 852.7, reward: 140, enemies: 0 },
  { id: 3, key: 'mission.3', district: 0, title: 'Noodles for Mrs. Okafor', brief: 'A regular customer ordered takeout across town and the delivery scooter is in the shop. Carry her noodles to City Park before they go cold.', type: 'deliver', x: 685.5, y: 1050, reward: 160, enemies: 0 },
  { id: 4, key: 'mission.4', district: 0, title: 'The Rent Man Cometh', brief: 'A landlord’s collector is leaning on Rico for back rent the diner never owed. Drive Rico’s old sedan to the corner office and settle the books in person.', type: 'drive', x: 1100, y: 702.7, reward: 200, enemies: 0 },
  { id: 5, key: 'mission.5', district: 0, title: 'Vulture Feathers', brief: 'The Vulture gang has started tagging every shutter on Neon Row. Maya tipped Leo off about their spray cans — collect the stash they hid behind the arcade.', type: 'collect', x: 850, y: 580.7, reward: 220, enemies: 0 },
  { id: 6, key: 'mission.6', district: 0, title: 'A Word With Kestrel', brief: 'Kestrel, the Vultures’ loudmouth lieutenant, is drinking at the Rusty Anchor. Walk in, sit down, and make it clear the diner is off limits.', type: 'talk', x: 500, y: 1302.7, reward: 260, enemies: 0 },
  { id: 7, key: 'mission.7', district: 0, title: 'Chase the Tagger', brief: 'A Vulture tagger just defaced the diner’s new sign and bolted on a scooter. Run him down through the side streets before he reaches the underpass.', type: 'chase', x: 1200, y: 880.7, reward: 300, enemies: 2 },
  { id: 8, key: 'mission.8', district: 0, title: 'The Alley Standoff', brief: 'Three Vultures cornered a delivery driver behind the market and took his cash box. Take the box back and make sure they remember who did it.', type: 'eliminate', x: 625, y: 1452.7, reward: 340, enemies: 3 },
  { id: 9, key: 'mission.9', district: 0, title: 'Hot Wheels, Cold Cash', brief: 'Rico’s cousin needs a car moved from Turbo Works to the safe house garage without the cops noticing the fresh paint job. Drive it clean and quiet.', type: 'drive', x: 123.8, y: 536.7, reward: 380, enemies: 0 },
  { id: 10, key: 'mission.10', district: 0, title: 'Neon Row Midnight Race', brief: 'A street racer named Jax bets his pink slip that no diner kid can beat him down Neon Row. Prove him wrong at the midnight starting line.', type: 'race', x: 950, y: 1002.7, reward: 450, enemies: 0 },
  { id: 11, key: 'mission.11', district: 0, title: 'Rico’s Old Debt', brief: 'A loan shark from the old neighborhood has come to collect a debt Rico thought was buried. Deliver the envelope to the shark’s man at the Cue Club.', type: 'deliver', x: 750, y: 880.7, reward: 480, enemies: 0 },
  { id: 12, key: 'mission.12', district: 0, title: 'The Informant on Fifth', brief: 'A nervous bookkeeper will trade the Vultures’ turf map for safe passage out of the district. Meet him on Fifth and walk him to the taxi stand.', type: 'talk', x: 400, y: 552.7, reward: 520, enemies: 0 },
  { id: 13, key: 'mission.13', district: 0, title: 'Warehouse of Feathers', brief: 'The turf map points to a Vulture stash house full of stolen electronics. Clear the guards and haul the crates out for Rico’s fence.', type: 'eliminate', x: 1285.5, y: 1700, reward: 580, enemies: 4 },
  { id: 14, key: 'mission.14', district: 0, title: 'Smoke Over the Market', brief: 'The Vultures torched a market stall to scare the shopkeepers into paying protection. Survive the ambush they left waiting in the smoke and save the stall.', type: 'survive', x: 750, y: 1180.7, reward: 640, enemies: 4 },
  { id: 15, key: 'mission.15', district: 0, title: 'The Getaway Driver Audition', brief: 'A fixer called Delia needs a driver who can lose a tail in downtown traffic. Take her sedan through the checkpoint course and shake the pursuit car.', type: 'chase', x: 1350, y: 580.7, reward: 700, enemies: 2 },
  { id: 16, key: 'mission.16', district: 0, title: 'Vulture Nest', brief: 'Leo has the whole Vulture roster now. Hit their clubhouse on the east edge of downtown and drive the gang out of the district for good.', type: 'eliminate', x: 1450, y: 1152.7, reward: 780, enemies: 4 },
  { id: 17, key: 'mission.17', district: 0, title: 'Crown of Neon Row', brief: 'With the Vultures gone, every small crew on Neon Row wants a piece of the turf. Race the circuit and plant the crew’s flag at all three checkpoints.', type: 'race', x: 535.5, y: 1650, reward: 850, enemies: 0 },
  { id: 18, key: 'mission.18', district: 0, title: 'Rico’s Confession', brief: 'Rico finally admits the diner’s deed is held by an airport cargo boss. Meet Rico at the diner after closing and hear the plan to steal it back.', type: 'talk', x: 450, y: 852.7, reward: 900, enemies: 0 },
  { id: 19, key: 'mission.19', district: 0, title: 'Tools of the Trade', brief: 'The heist needs a runway truck, a forged manifest, and a distraction at the cargo gate. Collect the three pieces stashed around downtown before dawn.', type: 'collect', x: 900, y: 1602.7, reward: 1000, enemies: 0 },
  { id: 20, key: 'mission.20', district: 0, title: 'The Cargo Heist', brief: 'Everything rides on one runway run: storm the airport cargo terminal, load the deed crate onto the truck, and tear down the runway while security gives chase. Pull it off and the road to Sunset Beach opens.', type: 'drive', x: 1162.5, y: 1570, reward: 1200, enemies: 0 },

  // ---- District 1: Sunset Beach (ids 21-40) — smuggling, races, casino ----
  { id: 21, key: 'mission.21', district: 1, title: 'Salt in the Air', brief: 'Leo rolls onto the boardwalk with the deed in hand and salt on the wind. Reach the Beach Shack and meet the smuggler who runs the pier.', type: 'goto', x: 1789.5, y: 1000, reward: 1250, enemies: 0 },
  { id: 22, key: 'mission.22', district: 1, title: 'The Pier Broker', brief: 'Captain Solana moves anything that floats, for a price. Talk her into lending the crew a boat for the night run.', type: 'talk', x: 2010.5, y: 1100, reward: 1300, enemies: 0 },
  { id: 23, key: 'mission.23', district: 1, title: 'First Night Run', brief: 'A sealed crate needs to cross the bay under cover of dark. Pilot the boat out past the pier lights and deliver it to the old lighthouse cove.', type: 'deliver', x: 2175, y: 652.7, reward: 1350, enemies: 0 },
  { id: 24, key: 'mission.24', district: 1, title: 'Boardwalk Sprint', brief: 'Beach racers mock the downtown crew’s cars as city toys. Settle it with a sprint down the boardwalk at sunset.', type: 'race', x: 1900, y: 680.7, reward: 1400, enemies: 0 },
  { id: 25, key: 'mission.25', district: 1, title: 'Tide Pool Pickups', brief: 'A tide-pool collector lost his specimen crates along the shore when the tide turned. Gather them before the waves take them out.', type: 'collect', x: 2125, y: 1319.3, reward: 1450, enemies: 0 },
  { id: 26, key: 'mission.26', district: 1, title: 'The Lifeguard’s Favor', brief: 'The head lifeguard’s brother is in debt to the boardwalk bookies. Talk the bookies down at their stall before the debt doubles at midnight.', type: 'talk', x: 1989.5, y: 900, reward: 1500, enemies: 0 },
  { id: 27, key: 'mission.27', district: 1, title: 'Harbor Rats', brief: 'A rival smuggling crew is hijacking Solana’s night runs. Chase their skiff back toward the harbor and run it aground.', type: 'chase', x: 2100, y: 1652.7, reward: 1580, enemies: 2 },
  { id: 28, key: 'mission.28', district: 1, title: 'The Sunken Ledger', brief: 'A waterproof ledger with every harbor payoff sits in a wreck off Pier 9. Swim out, grab it, and bring it back before the harbor rats find it first.', type: 'collect', x: 2337.5, y: 880.7, reward: 1650, enemies: 0 },
  { id: 29, key: 'mission.29', district: 1, title: 'Casino Courier', brief: 'A boardwalk casino host needs a velvet bag carried from the Beach Shack to the casino floor without anyone peeking inside. Deliver it and keep your mouth shut.', type: 'deliver', x: 2010.5, y: 550, reward: 1720, enemies: 0 },
  { id: 30, key: 'mission.30', district: 1, title: 'High Roller Distraction', brief: 'While the crew cases the casino vault, Leo has to keep the pit boss talking at the roulette table. Hold his attention until the signal.', type: 'talk', x: 2010.5, y: 550, reward: 1800, enemies: 0 },
  { id: 31, key: 'mission.31', district: 1, title: 'Jet Ski Ambush', brief: 'The harbor rats set a trap at the swim buoy line and opened fire on Solana’s boat. Clear them out and tow the boat back to the pier.', type: 'eliminate', x: 2189.5, y: 1200, reward: 1880, enemies: 3 },
  { id: 32, key: 'mission.32', district: 1, title: 'The Longest Night', brief: 'Three smuggling runs in one night, each hotter than the last, with harbor patrol sweeping the bay. Survive the night and bring every crate home.', type: 'survive', x: 2050, y: 1452.7, reward: 1950, enemies: 4 },
  { id: 33, key: 'mission.33', district: 1, title: 'Beach Guns Blazing', brief: 'A beach gang torched Solana’s storage shed to send a message. Take the fight to their stash house behind the gun shop and end the feud.', type: 'eliminate', x: 1675, y: 1347.3, reward: 2020, enemies: 4 },
  { id: 34, key: 'mission.34', district: 1, title: 'Sunset Grand Prix', brief: 'The whole beach turns out for the Sunset Grand Prix, a three-lap blast around the shore road. Win it and the crew’s name is painted on the pier.', type: 'race', x: 1950, y: 1480.7, reward: 2100, enemies: 0 },
  { id: 35, key: 'mission.35', district: 1, title: 'The Croupier’s Secret', brief: 'A casino croupier is skimming chips and wants out before security notices. Escort his evidence to Solana’s boat without the floor guards spotting the handoff.', type: 'drive', x: 2010.5, y: 1100, reward: 2180, enemies: 0 },
  { id: 36, key: 'mission.36', district: 1, title: 'Storm Surge Run', brief: 'A storm is rolling in and the last crate of the season has to move tonight. Drive the truck through the flooded shore road to the lighthouse before the waves close it.', type: 'drive', x: 2175, y: 652.7, reward: 2260, enemies: 0 },
  { id: 37, key: 'mission.37', district: 1, title: 'The Boardwalk King', brief: 'The boardwalk bookies’ enforcer has been shaking down every stall since the casino job. Run him down on his own turf and take back the stall money.', type: 'chase', x: 1810.5, y: 1200, reward: 2350, enemies: 3 },
  { id: 38, key: 'mission.38', district: 1, title: 'Vault Blueprints', brief: 'The casino vault’s blueprints are split across three safety deposit boxes along the boardwalk. Collect every page before the security rotation changes.', type: 'collect', x: 1989.5, y: 800, reward: 2440, enemies: 0 },
  { id: 39, key: 'mission.39', district: 1, title: 'Solana’s Farewell', brief: 'Solana is retiring to the north and leaves the crew her fastest boat — if they can outrun her old crew one last time along the coast. Say goodbye in style.', type: 'race', x: 2189.5, y: 550, reward: 2550, enemies: 0 },
  { id: 40, key: 'mission.40', district: 1, title: 'The Boardwalk Casino Job', brief: 'The vault, the crew, the boat, the storm — everything converges on one night. Crack the boardwalk casino vault, load the take onto Solana’s boat, and vanish into the dark. The haul buys the road into Cinder Peaks.', type: 'eliminate', x: 2010.5, y: 550, reward: 2700, enemies: 4 },

  // ---- District 2: Cinder Peaks (ids 41-60) — mountain gang war, lodge showdown ----
  { id: 41, key: 'mission.41', district: 2, title: 'Thin Air', brief: 'The mountain road climbs past the tree line into Cinder Peaks, where the air is thin and the welcome is thinner. Reach the Peak Lodge Cafe and find a friendly face.', type: 'goto', x: 1200, y: 164, reward: 2750, enemies: 0 },
  { id: 42, key: 'mission.42', district: 2, title: 'The Lodge Keeper', brief: 'Old Bram runs the lodge and knows every gang in the peaks by their tire tracks. Talk him into pointing the crew at the mountain gang’s supply line.', type: 'talk', x: 1200, y: 164, reward: 2780, enemies: 0 },
  { id: 43, key: 'mission.43', district: 2, title: 'Supply Line Snow Job', brief: 'The mountain gang’s supply truck crawls the pass every evening. Intercept the route and deliver the stolen medical crates to the lodge instead.', type: 'deliver', x: 600, y: 286, reward: 2800, enemies: 0 },
  { id: 44, key: 'mission.44', district: 2, title: 'Avalanche Alley', brief: 'A rival crew set charges above the pass to bury the crew’s truck. Race the falling snow down Avalanche Alley before the road disappears.', type: 'race', x: 400, y: 136, reward: 2820, enemies: 0 },
  { id: 45, key: 'mission.45', district: 2, title: 'The Frozen Cache', brief: 'A smuggler’s cache froze solid in a drift near the lake shore years ago. Dig out the marked crates before the thaw buries them for good.', type: 'collect', x: 1550, y: 286, reward: 2840, enemies: 0 },
  { id: 46, key: 'mission.46', district: 2, title: 'Ski Patrol Plea', brief: 'The ski patrol lost a radio relay in the storm and a stranded skier is waiting on the slope. Talk to the patrol chief and take the relay job.', type: 'talk', x: 889.5, y: 100, reward: 2860, enemies: 0 },
  { id: 47, key: 'mission.47', district: 2, title: 'Ridge Runners', brief: 'Mountain gang scouts on snow bikes are circling the lodge to cut its power. Chase them off the ridge before the lights go out.', type: 'chase', x: 1450, y: 314, reward: 2880, enemies: 2 },
  { id: 48, key: 'mission.48', district: 2, title: 'The Cabin Standoff', brief: 'Gang enforcers took over a mountain cabin and are holding the lodge’s cook hostage. Clear the cabin and bring the cook home.', type: 'eliminate', x: 2100, y: 286, reward: 2900, enemies: 3 },
  { id: 49, key: 'mission.49', district: 2, title: 'Lake Ice Delivery', brief: 'A fisherman’s hut on the far shore needs fuel before the lake ice locks the road. Drive the careful route around the frozen lake and deliver it.', type: 'deliver', x: 2200, y: 136, reward: 2920, enemies: 0 },
  { id: 50, key: 'mission.50', district: 2, title: 'The Chairlift Gambit', brief: 'The gang cut the chairlift cables to strand the lodge’s guests mid-slope. Climb to the lift station and hold the platform until the engineers finish the repair.', type: 'survive', x: 750, y: 286, reward: 2940, enemies: 4 },
  { id: 51, key: 'mission.51', district: 2, title: 'Snowblind Pursuit', brief: 'A gang courier with the lodge’s stolen payroll is fleeing toward the north pass in a whiteout. Run him down before he crosses the ridge.', type: 'chase', x: 2250, y: 314, reward: 2950, enemies: 3 },
  { id: 52, key: 'mission.52', district: 2, title: 'The Hermit’s Map', brief: 'A hermit living above the lake claims to know where the gang hides its war chest. Find his hut, hear him out, and take the map he offers.', type: 'talk', x: 1800, y: 314, reward: 2960, enemies: 0 },
  { id: 53, key: 'mission.53', district: 2, title: 'War Chest Fragments', brief: 'The hermit’s map marks four buried caches scattered across the peaks. Dig up every fragment of the war chest before the gang’s patrols find them.', type: 'collect', x: 1114.5, y: 75, reward: 2970, enemies: 0 },
  { id: 54, key: 'mission.54', district: 2, title: 'The Pass Blockade', brief: 'The mountain gang has blockaded the only pass out of the peaks with trucks and riflemen. Break the blockade and open the road.', type: 'eliminate', x: 500, y: 314, reward: 2980, enemies: 4 },
  { id: 55, key: 'mission.55', district: 2, title: 'Blizzard Holdout', brief: 'A blizzard traps the crew at the lodge with gang shooters closing in through the snow. Hold the lodge doors until dawn breaks the storm.', type: 'survive', x: 1200, y: 164, reward: 2990, enemies: 4 },
  { id: 56, key: 'mission.56', district: 2, title: 'The Summit Race', brief: 'To prove the crew owns the peaks, Leo challenges the gang’s best driver to a climb from the lodge to the summit beacon. Win the mountain.', type: 'race', x: 1300, y: 136, reward: 2995, enemies: 0 },
  { id: 57, key: 'mission.57', district: 2, title: 'Smoke Signals', brief: 'The gang’s lookout network is strung across the ridges with signal fires. Drive the ridge road and douse every fire before the final push.', type: 'drive', x: 1650, y: 314, reward: 3000, enemies: 0 },
  { id: 58, key: 'mission.58', district: 2, title: 'The Traitor’s Confession', brief: 'A gang lieutenant captured at the blockade wants to trade the lodge vault’s combination for a clean getaway. Hear him out at the old chapel.', type: 'talk', x: 300, y: 164, reward: 3000, enemies: 0 },
  { id: 59, key: 'mission.59', district: 2, title: 'The Long Climb', brief: 'One last supply run up the summit road in the dark: medicine, fuel, and the vault charges, all riding in one truck the gang will try to stop.', type: 'deliver', x: 1300, y: 136, reward: 3000, enemies: 0 },
  { id: 60, key: 'mission.60', district: 2, title: 'The Peak Lodge Score', brief: 'The mountain gang’s entire fortune sits in the vault beneath the peak lodge. Crack it, load the take, and fight your way down the summit as every gang in the peaks comes for you. Leo came to Neon Bay broke — tonight he leaves as a legend.', type: 'eliminate', x: 1300, y: 136, reward: 3000, enemies: 4 },
];

export const SIDE_QUEST_TEMPLATES = [
  { type: 'deliver', titleKey: 'side.template.0.title', briefKey: 'side.template.0.brief', title: 'Hot Delivery to {place}', brief: '{person} needs a package rushed to {place} before it cools down. Carry it there and don’t stop for anything.', baseReward: 120 },
  { type: 'taxi', titleKey: 'side.template.1.title', briefKey: 'side.template.1.brief', title: 'Cab Fare: {person} to {place}', brief: '{person} is in a hurry and will pay well for a fast, smooth ride to {place}. Mind the traffic.', baseReward: 100 },
  { type: 'photo', titleKey: 'side.template.2.title', briefKey: 'side.template.2.brief', title: 'Postcard Shot at {place}', brief: '{person} wants the perfect photo of {place} for a travel blog. Get to the spot and snap it at golden hour.', baseReward: 90 },
  { type: 'fight', titleKey: 'side.template.3.title', briefKey: 'side.template.3.brief', title: 'Trouble at {place}', brief: 'Some thugs are shaking down the regulars near {place} and {person} wants them taught a lesson. Handle it.', baseReward: 180 },
  { type: 'race', titleKey: 'side.template.4.title', briefKey: 'side.template.4.brief', title: 'Street Challenge at {place}', brief: '{person} swears nobody can beat their time around {place}. Prove them wrong and take the prize.', baseReward: 160 },
  { type: 'fetch', titleKey: 'side.template.5.title', briefKey: 'side.template.5.brief', title: 'Fetch It From {place}', brief: '{person} left something valuable at {place} and can’t go back for it. Bring it to them in one piece.', baseReward: 110 },
  { type: 'escort', titleKey: 'side.template.6.title', briefKey: 'side.template.6.brief', title: 'Walk {person} to {place}', brief: '{person} needs a safe escort to {place} after dark. Stay close and watch the alleys.', baseReward: 150 },
  { type: 'collect', titleKey: 'side.template.7.title', briefKey: 'side.template.7.brief', title: 'Lost and Found at {place}', brief: '{person} scattered their keepsakes all over {place} in the wind. Gather every last one.', baseReward: 130 },
  { type: 'deliver', titleKey: 'side.template.8.title', briefKey: 'side.template.8.brief', title: 'Midnight Parcel for {place}', brief: '{person} has a parcel that must reach {place} by midnight, no questions asked. Deliver it quietly.', baseReward: 140 },
  { type: 'taxi', titleKey: 'side.template.9.title', briefKey: 'side.template.9.brief', title: 'Airport Run for {person}', brief: '{person} is late for a flight and needs a driver who knows every shortcut to {place}. Floor it, carefully.', baseReward: 130 },
  { type: 'photo', titleKey: 'side.template.10.title', briefKey: 'side.template.10.brief', title: 'Sunset Shoot With {person}', brief: '{person} is a photographer chasing the last light at {place}. Guide them to the best vantage point.', baseReward: 100 },
  { type: 'fight', titleKey: 'side.template.11.title', briefKey: 'side.template.11.brief', title: 'Bar Brawl Backup at {place}', brief: '{person} got into it with the wrong crowd at {place} and needs backup fast. Even the odds.', baseReward: 200 },
];

export const SIDE_QUEST_PLACES = [
  { name: 'Neon Diner', x: 450, y: 852.7 },
  { name: 'Pier 9', x: 2262.5, y: 880.7 },
  { name: 'Peak Lodge', x: 1200, y: 164 },
  { name: 'Boardwalk', x: 1900, y: 680.7 },
  { name: 'Turbo Works', x: 900, y: 1602.7 },
  { name: 'City Park', x: 685.5, y: 1050 },
  { name: 'Old Lighthouse', x: 2175, y: 652.7 },
  { name: 'Mountain Cabin', x: 2100, y: 286 },
  { name: 'Cue Club', x: 750, y: 880.7 },
  { name: 'The Rusty Anchor', x: 500, y: 1302.7 },
  { name: 'Velvet Thread', x: 600, y: 702.7 },
  { name: 'Ironworks Arms', x: 300, y: 1152.7 },
  { name: 'Sunset Greens', x: 1950, y: 1480.7 },
  { name: 'Beach Shack', x: 1789.5, y: 1000 },
  { name: 'Neon Row Arcade', x: 850, y: 580.7 },
  { name: 'Harbor Market', x: 2050, y: 1452.7 },
  { name: 'Ski Lodge', x: 889.5, y: 100 },
  { name: 'Lakeview Hut', x: 2200, y: 136 },
  { name: 'Airport Terminal', x: 1175, y: 1480.7 },
  { name: 'Iron Paradise Gym', x: 814.5, y: 600 },
  { name: 'Boardwalk Casino', x: 2010.5, y: 550 },
  { name: 'Summit Beacon', x: 1300, y: 136 },
  { name: 'Fifth Street Books', x: 400, y: 552.7 },
  { name: 'Marina Office', x: 2010.5, y: 1100 },
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
  // Titles/briefs go through t() so a side quest reads in the active
  // language; {place}/{person} are proper nouns and stay as-is.
  const title = t(template.titleKey, { place: place.name, person: giver });
  const brief = t(template.briefKey, { place: place.name, person: giver });
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
  { id: 'diner', kind: 'food', name: 'Neon Diner', x: 450, y: 852.7 },
  { id: 'beach-shack', kind: 'food', name: 'Beach Shack', x: 1789.5, y: 1000 },
  { id: 'lodge-cafe', kind: 'food', name: 'Peak Lodge Cafe', x: 1200, y: 164 },
  { id: 'ironworks', kind: 'gun', name: 'Ironworks Arms', x: 300, y: 1152.7 },
  { id: 'beach-guns', kind: 'gun', name: 'Beach Guns', x: 1675, y: 1347.3 },
  { id: 'velvet-thread', kind: 'clothes', name: 'Velvet Thread', x: 600, y: 702.7 },
  { id: 'boardwalk-style', kind: 'clothes', name: 'Boardwalk Style', x: 1900, y: 680.7 },
  { id: 'turbo-works', kind: 'mods', name: 'Turbo Works', x: 900, y: 1602.7 },
];

export const ACTIVITY_SPOTS = [
  { kind: 'pool', name: 'Cue Club', x: 750, y: 880.7 },
  { kind: 'golf', name: 'Sunset Greens', x: 1950, y: 1480.7 },
  { kind: 'race', name: 'Airport Drag Strip', x: 1175, y: 1480.7 },
  { kind: 'swim', name: 'Pier 9 Swim', x: 2262.5, y: 880.7 },
  { kind: 'darts', name: 'The Rusty Anchor', x: 500, y: 1302.7 },
  { kind: 'gym', name: 'Iron Paradise', x: 814.5, y: 600 },
  // v4: pier fishing — a quiet beach pastime on the boardwalk (activities.js).
  { kind: 'fish', name: 'Pier 9 Fishing', x: 2262.5, y: 906.7 },
];

// v4: places of worship — generic, original, no real-world names or brands.
// kind: 'mosque' (dome + minaret), 'church' (tower + pitched roof),
// 'temple' (tiered roofs). x/y is the centre of the plot; world.js builds
// the hall around it and keeps other buildings clear of it.
// v7: 2 per district (was 3/2/3) — the most spread-out pair in each city,
// so no district has two of them piled on one street.
export const WORSHIP_PLACES = [
  { name: 'Bayview Chapel', kind: 'church', x: 287.5, y: 740, district: 0 },
  { name: 'Sunset Mosque', kind: 'mosque', x: 887.5, y: 1200, district: 0 },
  { name: 'Harbor Chapel', kind: 'church', x: 1887.5, y: 1070, district: 1 }, // v7: y 1066.7 -> 1070 — hall (y 1062..1078) overlapped a fillCells mid building ending at y 1060 by 1.3 m, so the fallback skipped it (worship 5/6 in browser)
  { name: 'Palm Mosque', kind: 'mosque', x: 2050, y: 1366.7, district: 1 },
  { name: 'Peak Temple', kind: 'temple', x: 650, y: 375, district: 2 },
  { name: 'Hill Mosque', kind: 'mosque', x: 2180, y: 375, district: 2 },
];

// v7: vital places — a hospital and a police station per district, spread
// across the city like the worship places (never two in one block). kind:
// 'hospital' (white hall, red-cross roof marker) or 'police' (navy hall,
// blue light bar). x/y is the centre of the plot; world.js builds the
// hall around it the same way it builds a worship hall, and map.js lists
// each one as a GPS destination.
export const VITAL_PLACES = [
  { name: 'Neon Bay General Hospital', kind: 'hospital', x: 1050, y: 950, district: 0 },
  { name: 'Downtown Police HQ', kind: 'police', x: 450, y: 1250, district: 0 },
  { name: 'Sunset Beach Clinic', kind: 'hospital', x: 1700, y: 1230, district: 1 },
  { name: 'Harbor Police Post', kind: 'police', x: 2060, y: 930, district: 1 },
  { name: 'Mountain Clinic', kind: 'hospital', x: 1000, y: 180, district: 2 },
  { name: 'Peak Ranger Station', kind: 'police', x: 2170, y: 180, district: 2 },
];

// v4: Peaks settlement — houses placed ALONG the mountain roads (y=450,
// y=900 and the four climbs), never in roadless forest: each home sits
// ~80-110 units off a road centreline, on the side away from the lake.
// world.js enforces the keep-out around mission points for these too.
export const PEAK_HOMES = [
  // Along the y=450 mountain road (south side).
  { x: 250, y: 186.7 }, { x: 500, y: 186.7 }, { x: 1450, y: 186.7 },
  { x: 2132.5, y: 186.7 }, { x: 2250, y: 186.7 },
  // Along the y=900 mountain road (south side).
  { x: 150, y: 336.7 }, { x: 562.5, y: 343.3 }, { x: 825, y: 336.7 },
  { x: 1250, y: 336.7 }, { x: 1862.5, y: 343.3 }, { x: 2312.5, y: 343.3 },
  // Along the y=900 mountain road (north side).
  { x: 342.5, y: 263.3 }, { x: 700, y: 263.3 }, { x: 975, y: 263.3 },
  { x: 1400, y: 263.3 }, { x: 1975, y: 263.3 },
  // Along the climbs (east side of each climb road, 130 off the centreline
  // so the house clears the road + sidewalk with room to spare).
  { x: 407.5, y: 66.7 }, { x: 407.5, y: 200 }, { x: 407.5, y: 366.7 },
  { x: 932.5, y: 66.7 }, { x: 932.5, y: 233.3 }, { x: 932.5, y: 383.3 },
  { x: 1157.5, y: 100 }, { x: 1157.5, y: 366.7 },
  { x: 2132.5, y: 66.7 }, { x: 2132.5, y: 233.3 }, { x: 2132.5, y: 383.3 },
];

// v4: Peaks points of interest — lookouts and food stalls on the roads, so
// the mountains are a place to visit, not a backdrop. kind: 'lookout' |
// 'stall' | 'cabin'. The Hermit Hut is mission 52's talk spot on purpose.
export const PEAK_POIS = [
  { name: 'Summit Viewpoint', kind: 'lookout', x: 1362.5, y: 100 },
  { name: 'Lakeview Point', kind: 'lookout', x: 1600, y: 273.3 },
  { name: 'Mountain Warung', kind: 'stall', x: 1137.5, y: 336.7 },
  { name: 'Lakeside Snack Stall', kind: 'stall', x: 2037.5, y: 216.7 },
  { name: 'Hermit Hut', kind: 'cabin', x: 1800, y: 314 },
];

// v4: neon sign texts for downtown towers and beach hotels (textures.js
// paints each as a glowing canvas texture). All original names.
export const NEON_SIGNS = [
  { text: 'NEON BAY', color: '#22d3ee' },
  { text: 'PIER 9', color: '#f472b6' },
  { text: 'CASINO', color: '#facc15' },
  { text: 'DINER', color: '#fb7185' },
  { text: 'SURF SHOP', color: '#34d399' },
  { text: 'HOTEL', color: '#a78bfa' },
  { text: 'LODGE', color: '#fbbf24' },
  { text: 'MARKET', color: '#38bdf8' },
];

export const WEAPON_SHOP_STOCK = ['rifle', 'shotgun', 'melee', 'grenade', 'bazooka'];

// Sky + lighting palettes for the 3D renderer (weather.js picks one by
// time of day and rain). Hex strings so both THREE colours and CSS can use
// them. v5b rewrite: one object per line, day/dusk a touch softer than v4
// (paler noon sky, warmer dusk, deeper night fog) so the sky, the fog and
// the hemisphere light agree instead of fighting each other.
export const SKY_COLORS = {
  // Noon: pale blue sky, light haze, warm-white sun; ground bounce greenish.
  day: { sky: '#8ec9e8', fog: '#c3d9e8', horizon: '#dceef7', sun: '#fff3b0', ambient: '#ffffff', hemiSky: '#bcd8ff', hemiGround: '#55604a' },
  // Golden hour: salmon sky, amber horizon, orange sun.
  dusk: { sky: '#e08a70', fog: '#d9a08c', horizon: '#f7c873', sun: '#ff9a3d', ambient: '#ffb38a', hemiSky: '#e8a87c', hemiGround: '#3a3230' },
  // Night: near-black blue, moonlight pale.
  night: { sky: '#0b1026', fog: '#10162c', horizon: '#1a2340', sun: '#e2e8f0', ambient: '#8fa3c7', hemiSky: '#25304f', hemiGround: '#0c0f16' },
  // Rain: flat grey-blue all round.
  rain: { sky: '#5b6b7a', fog: '#6b7a80', horizon: '#8a9aa0', sun: '#cfd8dc', ambient: '#b0bec5', hemiSky: '#7a8a94', hemiGround: '#2e3438' },
};

// Ground palette (v5b rewrite of the v5 block): the single source of truth
// for the surface colours textures.js paints. The three greys are kept
// apart on purpose — asphalt dark and cool, sidewalk light and cool,
// city ground mid and warm — so road, pavement and bare ground never
// collapse into one grey again. The remaining entries are the canvas base
// fills; each texture adds speckle and pattern on top of its base.
export const GROUND_COLORS = {
  // Roads and pavements.
  asphalt: '#20242c', sidewalk: '#a9adb3', cityGround: '#7d766a',
  curb: '#1c2126', lineWhite: '#f8fafc', lineYellow: '#facc15',
  // Natural and paved ground.
  grass: '#5a7046', sand: '#dcc078', dirt: '#6b5138', plaza: '#b3a586',
  rock: '#6b7280',
};

// Mountain peaks of Cinder Peaks for the 3D terrain (world.js): x/y are
// world coords, height is the peak height in metres, radius the base
// radius. v4.1, realistic scale: a real backdrop range NORTH of the map
// edge (centres y <= -850, bases ending at y = -50, 130 m clear of the
// ring road at y = 80) — 600-800 m peaks, hazed by the fog from downtown,
// never pyramids looming over the city. The Peaks settlement lives on
// the roads below them; the peaks are scenery you drive toward, not
// geometry the roads cut through.
export const MOUNTAIN_PEAKS = [
  { x: 300, y: -300, height: 700, radius: 212.5 },
  { x: 500, y: -283.3, height: 600, radius: 200 },
  { x: 750, y: -333.3, height: 800, radius: 237.5 },
  { x: 1100, y: -300, height: 650, radius: 212.5 },
  { x: 1300, y: -316.7, height: 750, radius: 225 },
  { x: 1700, y: -283.3, height: 650, radius: 200 },
  { x: 1900, y: -316.7, height: 750, radius: 225 },
  { x: 2150, y: -300, height: 700, radius: 212.5 },
];

// ---------------------------------------------------------------------------
// i18n: this module owns the story + dialogue strings. English is
// registered from the source arrays above (no duplication); Indonesian
// lives in the literal below. Display code reads them with
// t('mission.3.title'), t('side.template.0.title', { place, person }),
// t('maya.2'), t('dialogue.greet.5'), t('dialogue.tip.1') — the English
// fallback is the source text itself. Proper nouns (people, place names)
// are NOT translated, only the words around them (see i18n.js).
{
  const EN = {};
  for (const m of STORY_MISSIONS) {
    EN[`mission.${m.id}.title`] = m.title;
    EN[`mission.${m.id}.brief`] = m.brief;
  }
  for (const [i, tpl] of SIDE_QUEST_TEMPLATES.entries()) {
    EN[`side.template.${i}.title`] = tpl.title;
    EN[`side.template.${i}.brief`] = tpl.brief;
  }
  for (const [i, line] of MAYA_LINES.entries()) EN[`maya.${i}`] = line;
  for (const [i, line] of DIALOGUE_GREETINGS.entries()) EN[`dialogue.greet.${i}`] = line;
  for (const [i, line] of DIALOGUE_TIPS.entries()) EN[`dialogue.tip.${i}`] = line;
  addStrings('en', EN);
}

addStrings('id', {
  // ---- Story missions 1-20 (Downtown) ----
  'mission.1.title': 'Broke di Halte Bus',
  'mission.1.brief': 'Leo turun dari bus malam dengan dua tas dan empat puluh dolar. Teman lamanya Maya menunggu di dekat Neon Diner dengan sebuah petunjuk — datangi diner itu dan tanyakan Rico soal pekerjaan.',
  'mission.2.title': 'Shift Pertama di Diner',
  'mission.2.brief': 'Rico langsung mempekerjakan Leo kalau dia bisa menangani jam makan siang yang ramai. Bicara dengan Rico di balik meja dan terima pekerjaan itu.',
  'mission.3.title': 'Mie untuk Mrs. Okafor',
  'mission.3.brief': 'Pelanggan tetap memesan makanan bawa pulang ke seberang kota dan skuter antar sedang diperbaiki. Antar mienya ke City Park sebelum dingin.',
  'mission.4.title': 'Penagih Sewa Datang',
  'mission.4.brief': 'Penagih sewa tuan tanah menekan Rico untuk tunggakan sewa yang sebenarnya tidak pernah ada. Kendarai sedan tua Rico ke kantor pojok dan bereskan pembukuannya langsung.',
  'mission.5.title': 'Bulu Vulture',
  'mission.5.brief': 'Geng Vulture mulai menandai setiap pintu toko di Neon Row. Maya memberi tahu Leo soal kaleng cat mereka — kumpulkan persembunyian di belakang arcade.',
  'mission.6.title': 'Bicara dengan Kestrel',
  'mission.6.brief': 'Kestrel, letnan Vulture yang banyak bicara, sedang minum di Rusty Anchor. Masuk, duduk, dan tegaskan bahwa diner itu terlarang bagi mereka.',
  'mission.7.title': 'Kejar si Tukang Coret',
  'mission.7.brief': 'Seorang tukang coret Vulture baru saja merusak papan nama diner dan kabur dengan skuter. Kejar dia melewati gang-gang kecil sebelum dia sampai di jalan layang.',
  'mission.8.title': 'Baku Hantam di Gang',
  'mission.8.brief': 'Tiga anggota Vulture menyudutkan seorang sopir antar di belakang pasar dan mengambil kotak uangnya. Rebut kembali kotak itu dan pastikan mereka ingat siapa yang melakukannya.',
  'mission.9.title': 'Mobil Panas, Uang Dingin',
  'mission.9.brief': 'Sepupu Rico butuh mobil dipindahkan dari Turbo Works ke garasi safe house tanpa polisi menyadari cat barunya. Kendarai dengan bersih dan tenang.',
  'mission.10.title': 'Balapan Tengah Malam di Neon Row',
  'mission.10.brief': 'Pembalap jalanan bernama Jax mempertaruhkan surat mobilnya bahwa tak ada anak diner yang bisa mengalahkannya di Neon Row. Buktikan dia salah di garis start tengah malam.',
  'mission.11.title': 'Utang Lama Rico',
  'mission.11.brief': 'Seorang rentenir dari lingkungan lama datang menagih utang yang dikira Rico sudah terkubur. Antar amplop itu ke orangnya di Cue Club.',
  'mission.12.title': 'Informan di Fifth',
  'mission.12.brief': 'Seorang pembukuan yang gugup akan menukar peta wilayah Vulture dengan jalan keluar yang aman dari distrik ini. Temui dia di Fifth dan antar dia ke pangkalan taksi.',
  'mission.13.title': 'Gudang Bulu',
  'mission.13.brief': 'Peta wilayah itu menunjuk ke rumah persembunyian Vulture yang penuh barang elektronik curian. Bersihkan penjaganya dan bawa peti-peti itu untuk penadah Rico.',
  'mission.14.title': 'Asap di Atas Pasar',
  'mission.14.brief': 'Para Vulture membakar kios pasar untuk menakut-nakuti pemilik toko agar membayar uang perlindungan. Bertahan dari penyergapan yang mereka tinggalkan dalam asap dan selamatkan kios itu.',
  'mission.15.title': 'Audisi Sopir Kabur',
  'mission.15.brief': 'Seorang perantara bernama Delia butuh sopir yang bisa menghilangkan ekor di lalu lintas pusat kota. Bawa sedannya melewati jalur checkpoint dan goyahkan mobil pengejar.',
  'mission.16.title': 'Sarang Vulture',
  'mission.16.brief': 'Leo kini memegang seluruh daftar anggota Vulture. Serang markas mereka di ujung timur pusat kota dan usir geng itu dari distrik untuk selamanya.',
  'mission.17.title': 'Mahkota Neon Row',
  'mission.17.brief': 'Dengan Vulture pergi, setiap kru kecil di Neon Row menginginkan sebagian wilayah. Balapan di sirkuit dan tancapkan bendera kru di ketiga checkpoint.',
  'mission.18.title': 'Pengakuan Rico',
  'mission.18.brief': 'Rico akhirnya mengaku bahwa akta diner dipegang oleh bos kargo bandara. Temui Rico di diner setelah tutup dan dengarkan rencana untuk mencurinya kembali.',
  'mission.19.title': 'Alat-Alat Kerja',
  'mission.19.brief': 'Perampokan itu butuh truk landasan, manifes palsu, dan pengalih perhatian di gerbang kargo. Kumpulkan ketiga barang yang disembunyikan di sekitar pusat kota sebelum fajar.',
  'mission.20.title': 'Perampokan Kargo',
  'mission.20.brief': 'Semuanya dipertaruhkan dalam satu lari di landasan: serbu terminal kargo bandara, muat peti akta ke truk, dan melesat di landasan selagi keamanan mengejar. Berhasil, dan jalan ke Sunset Beach terbuka.',
  // ---- Story missions 21-40 (Sunset Beach) ----
  'mission.21.title': 'Garam di Udara',
  'mission.21.brief': 'Leo meluncur ke boardwalk dengan akta di tangan dan garam di angin. Capai Beach Shack dan temui penyelundup yang menguasai dermaga.',
  'mission.22.title': 'Makelar Dermaga',
  'mission.22.brief': 'Kapten Solana memindahkan apa saja yang mengapung, dengan harga. Bujuk dia agar meminjamkan kru sebuah perahu untuk pelayaran malam.',
  'mission.23.title': 'Pelayaran Malam Pertama',
  'mission.23.brief': 'Sebuah peti tersegel harus menyeberangi teluk dalam gelap. Kemudikan perahu melewati lampu dermaga dan antar ke teluk mercusuar tua.',
  'mission.24.title': 'Sprint Boardwalk',
  'mission.24.brief': 'Pembalap pantai mengejek mobil kru pusat kota sebagai mainan kota. Selesaikan dengan sprint di boardwalk saat matahari terbenam.',
  'mission.25.title': 'Mengumpulkan di Kolam Pasang',
  'mission.25.brief': 'Seorang pengumpul kolam pasang kehilangan peti-peti spesimennya di sepanjang pantai saat air pasang berubah. Kumpulkan sebelum ombak membawanya pergi.',
  'mission.26.title': 'Permintaan Penjaga Pantai',
  'mission.26.brief': 'Saudara kepala penjaga pantai berutang pada bandar boardwalk. Bujuk para bandar di kios mereka sebelum utang itu berlipat ganda di tengah malam.',
  'mission.27.title': 'Tikus Pelabuhan',
  'mission.27.brief': 'Kru penyelundup saingan membajak pelayaran malam Solana. Kejar sekoci mereka ke arah pelabuhan dan kandaskan.',
  'mission.28.title': 'Buku Besar yang Tenggelam',
  'mission.28.brief': 'Sebuah buku besar tahan air berisi semua suap pelabuhan tergeletak di bangkai kapal dekat Pier 9. Berenanglah, ambil, dan bawa kembali sebelum tikus pelabuhan menemukannya.',
  'mission.29.title': 'Kurir Kasino',
  'mission.29.brief': 'Pembawa acara kasino boardwalk butuh tas beludru dibawa dari Beach Shack ke lantai kasino tanpa ada yang mengintip isinya. Antar dan tutup mulutmu.',
  'mission.30.title': 'Pengalih Perhatian Pejudi Kakap',
  'mission.30.brief': 'Selagi kru mengintai brankas kasino, Leo harus membuat bos meja tetap mengobrol di meja roulette. Tahan perhatiannya sampai ada sinyal.',
  'mission.31.title': 'Penyergapan Jet Ski',
  'mission.31.brief': 'Tikus pelabuhan memasang jebakan di garis pelampung renang dan menembaki perahu Solana. Bersihkan mereka dan tarik perahu kembali ke dermaga.',
  'mission.32.title': 'Malam Terpanjang',
  'mission.32.brief': 'Tiga pelayaran penyelundupan dalam satu malam, masing-masing lebih panas dari sebelumnya, dengan patroli pelabuhan menyapu teluk. Bertahan semalam dan bawa pulang semua peti.',
  'mission.33.title': 'Beach Guns Membara',
  'mission.33.brief': 'Geng pantai membakar gudang Solana untuk mengirim pesan. Bawa pertarungan ke rumah persembunyian mereka di belakang toko senjata dan akhiri permusuhan itu.',
  'mission.34.title': 'Grand Prix Sunset',
  'mission.34.brief': 'Seluruh pantai keluar untuk Sunset Grand Prix, balapan tiga putaran di sepanjang jalan pantai. Menang dan nama kru akan dilukis di dermaga.',
  'mission.35.title': 'Rahasia si Bandar',
  'mission.35.brief': 'Seorang bandar kasino menggelapkan chip dan ingin keluar sebelum keamanan menyadarinya. Kawal buktinya ke perahu Solana tanpa penjaga lantai melihat serah terima itu.',
  'mission.36.title': 'Lari di Tengah Badai',
  'mission.36.brief': 'Badai datang dan peti terakhir musim ini harus bergerak malam ini. Kendarai truk melewati jalan pantai yang tergenang ke mercusuar sebelum ombak menutup jalan.',
  'mission.37.title': 'Raja Boardwalk',
  'mission.37.brief': 'Penegak bandar boardwalk memeras setiap kios sejak pekerjaan kasino. Kejar dia di wilayahnya sendiri dan rebut kembali uang kios.',
  'mission.38.title': 'Denah Brankas',
  'mission.38.brief': 'Denah brankas kasino terbagi di tiga kotak simpanan di sepanjang boardwalk. Kumpulkan setiap halaman sebelum rotasi keamanan berubah.',
  'mission.39.title': 'Perpisahan Solana',
  'mission.39.brief': 'Solana pensiun ke utara dan meninggalkan kru perahu tercepatnya — jika mereka bisa mengalahkan kru lamanya untuk terakhir kali di sepanjang pantai. Ucapkan selamat tinggal dengan gaya.',
  'mission.40.title': 'Perampokan Kasino Boardwalk',
  'mission.40.brief': 'Brankas, kru, perahu, badai — semuanya bertemu dalam satu malam. Bobol brankas kasino boardwalk, muat hasil rampokan ke perahu Solana, dan lenyap ke dalam gelap. Hasilnya membeli jalan ke Cinder Peaks.',
  // ---- Story missions 41-60 (Cinder Peaks) ----
  'mission.41.title': 'Udara Tipis',
  'mission.41.brief': 'Jalan gunung mendaki melewati batas pepohonan ke Cinder Peaks, tempat udaranya tipis dan sambutannya lebih tipis. Capai Peak Lodge Cafe dan temukan wajah yang ramah.',
  'mission.42.title': 'Penjaga Penginapan',
  'mission.42.brief': 'Bram tua menjalankan penginapan dan mengenal setiap geng di pegunungan dari jejak ban mereka. Bujuk dia agar menunjuk kru ke jalur pasokan geng gunung.',
  'mission.43.title': 'Jalur Pasokan Bersalju',
  'mission.43.brief': 'Truk pasokan geng gunung merangkak melewati jalur itu setiap sore. Potong rutenya dan antar peti-peti medis curian ke penginapan.',
  'mission.44.title': 'Gang Longsoran',
  'mission.44.brief': 'Kru saingan memasang bahan peledak di atas jalur untuk mengubur truk kru. Balapan menuruni salju yang jatuh di Avalanche Alley sebelum jalan menghilang.',
  'mission.45.title': 'Tempat Persembunyian Beku',
  'mission.45.brief': 'Tempat persembunyian penyelundup membeku di tumpukan salju dekat tepi danau bertahun-tahun lalu. Gali peti-peti bertanda sebelum salju yang mencair menguburnya selamanya.',
  'mission.46.title': 'Permohonan Patroli Ski',
  'mission.46.brief': 'Patroli ski kehilangan relay radio dalam badai dan seorang pemain ski yang terdampar menunggu di lereng. Bicara dengan kepala patroli dan ambil pekerjaan relay itu.',
  'mission.47.title': 'Pelari Ridge',
  'mission.47.brief': 'Pramuka geng gunung dengan sepeda salju mengelilingi penginapan untuk memutus listriknya. Usir mereka dari punggung bukit sebelum lampu padam.',
  'mission.48.title': 'Baku Tembak di Kabin',
  'mission.48.brief': 'Penegak geng mengambil alih kabin gunung dan menyandera juru masak penginapan. Bersihkan kabin dan bawa pulang juru masak itu.',
  'mission.49.title': 'Pengiriman di Atas Es Danau',
  'mission.49.brief': 'Gubuk nelayan di tepi seberang butuh bahan bakar sebelum es danau mengunci jalan. Kendarai rute hati-hati mengelilingi danau beku dan antar itu.',
  'mission.50.title': 'Taktik Kursi Gantung',
  'mission.50.brief': 'Geng memutus kabel kursi gantung untuk menggantung para tamu penginapan di tengah lereng. Naik ke stasiun lift dan tahan platform sampai para insinyur selesai memperbaiki.',
  'mission.51.title': 'Pengejaran dalam Badai Salju',
  'mission.51.brief': 'Seorang kurir geng dengan gaji curian penginapan melarikan diri ke jalur utara dalam badai putih. Kejar dia sebelum dia melewati punggung bukit.',
  'mission.52.title': 'Peta si Pertapa',
  'mission.52.brief': 'Seorang pertapa yang tinggal di atas danau mengaku tahu di mana geng menyembunyikan peti perangnya. Temukan gubuknya, dengarkan dia, dan ambil peta yang dia tawarkan.',
  'mission.53.title': 'Fragmen Peti Perang',
  'mission.53.brief': 'Peta si pertapa menandai empat tempat persembunyian terkubur yang tersebar di pegunungan. Gali setiap fragmen peti perang sebelum patroli geng menemukannya.',
  'mission.54.title': 'Blokade Jalur',
  'mission.54.brief': 'Geng gunung memblokade satu-satunya jalur keluar dari pegunungan dengan truk dan penembak. Hancurkan blokade dan buka jalan.',
  'mission.55.title': 'Bertahan di Tengah Badai Salju',
  'mission.55.brief': 'Badai salju menjebak kru di penginapan dengan penembak geng yang mendekat menembus salju. Tahan pintu penginapan sampai fajar memecah badai.',
  'mission.56.title': 'Balapan Puncak',
  'mission.56.brief': 'Untuk membuktikan kru menguasai pegunungan, Leo menantang pembalap terbaik geng untuk mendaki dari penginapan ke suar puncak. Menangkan gunung itu.',
  'mission.57.title': 'Sinyal Asap',
  'mission.57.brief': 'Jaringan pengintai geng terbentang di punggung bukit dengan api sinyal. Kendarai jalan punggung bukit dan padamkan setiap api sebelum dorongan terakhir.',
  'mission.58.title': 'Pengakuan si Pengkhianat',
  'mission.58.brief': 'Seorang letnan geng yang ditangkap di blokade ingin menukar kombinasi brankas penginapan dengan jalan keluar yang bersih. Dengarkan dia di kapel tua.',
  'mission.59.title': 'Pendakian Panjang',
  'mission.59.brief': 'Satu lari pasokan terakhir mendaki jalan puncak dalam gelap: obat-obatan, bahan bakar, dan muatan brankas, semuanya dalam satu truk yang akan coba dihentikan geng.',
  'mission.60.title': 'Perampokan Penginapan Puncak',
  'mission.60.brief': 'Seluruh kekayaan geng gunung tersimpan di brankas bawah penginapan puncak. Bobol, muat hasil rampokan, dan bertarunglah menuruni puncak selagi setiap geng di pegunungan mengejarmu. Leo datang ke Neon Bay dengan tangan kosong — malam ini dia pergi sebagai legenda.',
  // ---- Side quest templates ----
  'side.template.0.title': 'Antar Cepat ke {place}',
  'side.template.0.brief': '{person} butuh paket dikirim cepat ke {place} sebelum dingin. Bawa ke sana dan jangan berhenti untuk apa pun.',
  'side.template.1.title': 'Ongkos Taksi: {person} ke {place}',
  'side.template.1.brief': '{person} sedang terburu-buru dan akan membayar mahal untuk perjalanan cepat dan mulus ke {place}. Hati-hati dengan lalu lintas.',
  'side.template.2.title': 'Foto Kartu Pos di {place}',
  'side.template.2.brief': '{person} ingin foto sempurna {place} untuk blog perjalanan. Datang ke tempat itu dan ambil saat golden hour.',
  'side.template.3.title': 'Masalah di {place}',
  'side.template.3.brief': 'Beberapa preman memeras pelanggan tetap di dekat {place} dan {person} ingin mereka diberi pelajaran. Tangani.',
  'side.template.4.title': 'Tantangan Jalanan di {place}',
  'side.template.4.brief': '{person} bersumpah tak ada yang bisa mengalahkan waktunya di sekitar {place}. Buktikan dia salah dan rebut hadiahnya.',
  'side.template.5.title': 'Ambilkan dari {place}',
  'side.template.5.brief': '{person} meninggalkan sesuatu yang berharga di {place} dan tidak bisa kembali mengambilnya. Bawa ke mereka dengan utuh.',
  'side.template.6.title': 'Kawal {person} ke {place}',
  'side.template.6.brief': '{person} butuh pengawalan aman ke {place} setelah gelap. Tetap dekat dan awasi gang-gang.',
  'side.template.7.title': 'Barang Hilang di {place}',
  'side.template.7.brief': '{person} menyebarkan barang-barang kesayangannya di seluruh {place} tertiup angin. Kumpulkan semuanya.',
  'side.template.8.title': 'Paket Tengah Malam untuk {place}',
  'side.template.8.brief': '{person} punya paket yang harus sampai ke {place} sebelum tengah malam, tanpa banyak pertanyaan. Antar dengan tenang.',
  'side.template.9.title': 'Antar ke Bandara untuk {person}',
  'side.template.9.brief': '{person} terlambat untuk penerbangan dan butuh sopir yang tahu semua jalan pintas ke {place}. Tancap gas, hati-hati.',
  'side.template.10.title': 'Pemotretan Senja Bersama {person}',
  'side.template.10.brief': '{person} adalah fotografer yang mengejar cahaya terakhir di {place}. Pandu mereka ke sudut pandang terbaik.',
  'side.template.11.title': 'Bantuan Perkelahian Bar di {place}',
  'side.template.11.brief': '{person} terlibat dengan kerumunan yang salah di {place} dan butuh bantuan cepat. Seimbangkan keadaan.',
  // ---- Maya lines ----
  'maya.0': 'Leo! Kamu berhasil turun dari bus itu. Rico sudah menanyakanmu — temui dia, dia punya pekerjaan.',
  'maya.1': 'Para Vulture menandai arcade lagi tadi malam. Persembunyian mereka ada di belakangnya, kalau kamu berani.',
  'maya.2': 'Kabarnya gerbang pantai hanya terbuka untuk siapa pun yang melakukan pekerjaan bandara. Itu rencana Rico, bukan rencanaku.',
  'maya.3': 'Aku dengar pekerjaan brankas kasino butuh sopir yang bisa membuat bos meja terus mengobrol. Itu terdengar seperti kamu.',
  'maya.4': 'Jaga dirimu di luar sana. Kota ini memakan orang yang bergegas masuk sendirian — dan sekarang kamu sendirian.',
  'maya.5': 'Kalau kamu butuh uang cepat, selalu ada kerja sampingan. Tanya-tanya — selalu ada yang tahu sesuatu.',
  // ---- NPC greetings ----
  'dialogue.greet.0': 'Hei, hati-hati dengan lalu lintas di luar sana.',
  'dialogue.greet.1': 'Neon Bay tidak pernah tidur, Nak.',
  'dialogue.greet.2': 'Kamu terlihat baru di sini. Tetap waspada.',
  'dialogue.greet.3': 'Hari yang indah, kalau kamu mengabaikan sirene.',
  'dialogue.greet.4': 'Aku melihat semuanya. Tanya aku apa saja.',
  'dialogue.greet.5': 'Pantai ke arah sana. Masalah ada di mana-mana.',
  'dialogue.greet.6': 'Kendaraan bagus. Jangan tergores di jalanku.',
  'dialogue.greet.7': 'Diner Rico menyajikan mie terbaik di kota.',
  'dialogue.greet.8': 'Hati-hati di pegunungan — jalannya menggigit.',
  'dialogue.greet.9': 'Kamu menuju boardwalk? Lewat jalan pantai.',
  'dialogue.greet.10': 'Aku dengar kasino punya keamanan baru malam ini.',
  'dialogue.greet.11': 'Kalau butuh kerja, tanya-tanya di sekitar pasar.',
  'dialogue.greet.12': 'Lampu mercusuar masih berfungsi, kau tahu.',
  'dialogue.greet.13': 'Jangan beri makan burung camar. Mereka ingat wajah.',
  // ---- NPC tips ----
  'dialogue.tip.0': 'Makanlah di diner untuk memulihkan diri sebelum bertarung.',
  'dialogue.tip.1': 'Mobilmu pulih di garasi. Gunakan itu.',
  'dialogue.tip.2': 'Bintang wanted memudar kalau kamu tidak terlihat.',
  'dialogue.tip.3': 'Senjata yang lebih bagus lebih mahal, tapi mengakhiri pertarungan lebih cepat.',
  'dialogue.tip.4': 'Simpan uangmu — bazoka itu sepadan.',
  'dialogue.tip.5': 'Berenanglah pelan dekat dermaga atau arusnya membawamu.',
  'dialogue.tip.6': 'Mobil cepat mengalahkan senjata cepat dalam pengejaran.',
  'dialogue.tip.7': 'Periksa peta: penanda emas adalah pekerjaanmu berikutnya.',
  'dialogue.tip.8': 'Pakaian tidak mengubah armormu, hanya penampilanmu.',
  'dialogue.tip.9': 'Bicara dengan semua orang. Selalu ada yang tahu sesuatu.',
  'dialogue.tip.10': 'Balapan paling menguntungkan kalau kamu memotong tikungan dengan bersih.',
  'dialogue.tip.11': 'Awasi jam — malam makin berat.',
});
