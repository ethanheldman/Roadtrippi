import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedAttraction = {
  name: string;
  city: string;
  state: string;
  description: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
};

// Roadside America image/source for select attractions
const ROADSIDE_AMERICA = {
  "Barstow Station McDonald's": {
    sourceUrl: "https://www.roadsideamerica.com/tip/27618",
    imageUrl: "https://www.roadsideamerica.com/attract/images/ca/CABARstation_renken1.jpg",
  },
  "Newport Beach Pirate House": {
    sourceUrl: "https://www.roadsideamerica.com/tip/30694",
    imageUrl: "https://www.roadsideamerica.com/attract/images/ca/CANEWpirates_kreuzer2.jpg",
  },
  "Eddie World": {
    sourceUrl: "https://www.roadsideamerica.com/tip/59710",
    imageUrl: "https://www.roadsideamerica.com/attract/images/ca/CAYERsundae_kareng.jpg",
  },
  "Lake Dolores Waterpark": {
    sourceUrl: "https://www.roadsideamerica.com/tip/41940",
    imageUrl: "https://www.roadsideamerica.com/attract/images/ca/CANEWrockahoola_maya.jpg",
  },
  "Alien Fresh Jerky": {
    sourceUrl: "https://www.roadsideamerica.com/tip/10296",
    imageUrl: "https://www.roadsideamerica.com/attract/images/ca/CABAKalien_dk0887_640x640.jpg",
  },
  "Goldwell Open Air Museum": {
    sourceUrl: "https://www.roadsideamerica.com/tip/3201",
    imageUrl: "https://www.roadsideamerica.com/attract/images/nv/NVRHYvenus_3128.jpg",
  },
  "Car Forest": {
    sourceUrl: "https://www.roadsideamerica.com/tip/37042",
    imageUrl: "https://www.roadsideamerica.com/attract/images/nv/NVGOLcarforest_lamc2_640x310.jpg",
  },
  "Gospodor Monument Park": {
    sourceUrl: "https://www.roadsideamerica.com/tip/7757",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Gospodor_Monument_Park%2C_WA%2C_2016.jpg/800px-Gospodor_Monument_Park%2C_WA%2C_2016.jpg",
  },
  "Mystery Spot": {
    sourceUrl: "https://www.roadsideamerica.com/story/2033",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Mystery_spot_entrance.jpg/800px-Mystery_spot_entrance.jpg",
  },
  "Cadillac Ranch": {
    sourceUrl: "https://www.roadsideamerica.com/story/2220",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Cadillac_Ranch.jpg/800px-Cadillac_Ranch.jpg",
  },
  "Lucy the Elephant": {
    sourceUrl: "https://www.roadsideamerica.com/story/2162",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Lucy_the_Elephant.jpg/800px-Lucy_the_Elephant.jpg",
  },
  "Carhenge": {
    sourceUrl: "https://www.roadsideamerica.com/story/2606",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/A452%2C_Carhenge%2C_Alliance%2C_Nebraska%2C_USA%2C_central_cars%2C_2016.jpg/800px-A452%2C_Carhenge%2C_Alliance%2C_Nebraska%2C_USA%2C_central_cars%2C_2016.jpg",
  },
  "Cabazon Dinosaurs": {
    sourceUrl: "https://www.roadsideamerica.com/story/2031",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Cabazon-Dinosaurs-2.jpg/800px-Cabazon-Dinosaurs-2.jpg",
  },
  "Trolls: Guardians of the Seeds": {
    sourceUrl: "https://www.roadsideamerica.com/tip/82210",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Thomas_Dambo_troll_at_Coastal_Maine_Botanical_Gardens.jpg",
  },
  "Blue Whale of Catoosa": {
    sourceUrl: "https://www.roadsideamerica.com/story/8543",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Catoosa_Blue_Whale.jpg/800px-Catoosa_Blue_Whale.jpg",
  },
  "World's Largest Fork": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/World%27s_Largest_Fork_-_Springfield%2C_MO.jpg/800px-World%27s_Largest_Fork_-_Springfield%2C_MO.jpg",
  },
  "Jolly Green Giant": {
    sourceUrl: "https://www.roadsideamerica.com/tip/2660",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Jolly_Green_Giant_Statue.jpg/800px-Jolly_Green_Giant_Statue.jpg",
  },
  "World's Largest Ball of Paint": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/World%27s_Largest_Ball_of_Paint.jpg/800px-World%27s_Largest_Ball_of_Paint.jpg",
  },
  "Giant Coffee Pot": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Giant_Coffee_Pot_Bedford_PA.jpg/800px-Giant_Coffee_Pot_Bedford_PA.jpg",
  },
  "World's Largest Pecan": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/World%27s_Largest_Pecan_Seguin_Texas.jpg/800px-World%27s_Largest_Pecan_Seguin_Texas.jpg",
  },
  "World's Largest Frying Pan": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Long_Beach_WA_frying_pan.jpg/800px-Long_Beach_WA_frying_pan.jpg",
  },
  "Giant Abraham Lincoln": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Young_Lincoln_Statue_Dixon_IL.jpg/800px-Young_Lincoln_Statue_Dixon_IL.jpg",
  },
  "World's Largest Mailbox": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/World%27s_Largest_Mailbox_Casey_IL.jpg/800px-World%27s_Largest_Mailbox_Casey_IL.jpg",
  },
  "Corn Palace": {
    sourceUrl: "https://www.roadsideamerica.com/story/8543",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Corn_Palace_mitchell_south_dakota.jpg/800px-Corn_Palace_mitchell_south_dakota.jpg",
  },
  "World's Largest Buffalo": {
    sourceUrl: "https://www.roadsideamerica.com/tip/2660",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/World%27s_Largest_Buffalo_Jamestown_ND.jpg/800px-World%27s_Largest_Buffalo_Jamestown_ND.jpg",
  },
  "World's Largest Catsup Bottle": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/World%27s_Largest_Ketchup_Bottle_Collinsville_IL.jpg/800px-World%27s_Largest_Ketchup_Bottle_Collinsville_IL.jpg",
  },
  "Salvation Mountain": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Salvation_Mountain.jpg/800px-Salvation_Mountain.jpg",
  },
  "Giant Lobster": {
    sourceUrl: "https://www.roadsideamerica.com/tip/82210",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/82/Giant_Lobster_Boothbay_ME.jpg",
  },
  "World's Largest Chest of Drawers": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/World%27s_Largest_Chest_of_Drawers_High_Point_NC.jpg/800px-World%27s_Largest_Chest_of_Drawers_High_Point_NC.jpg",
  },
  "Giant Penguin": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Giant_Penguin_Cut_Bank_MT.jpg/800px-Giant_Penguin_Cut_Bank_MT.jpg",
  },
  "Fremont Troll": {
    sourceUrl: "https://www.roadsideamerica.com/location/wa",
    imageUrl: "/uploads/attractions/fremont-troll.jpg",
  },
  "World's Largest Pistachio": {
    sourceUrl: "https://www.roadsideamerica.com/story/19946",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/World%27s_Largest_Pistachio.jpg/800px-World%27s_Largest_Pistachio.jpg",
  },
  "Foamhenge": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Foamhenge_-07-_%289722873379%29.jpg/800px-Foamhenge_-07-_%289722873379%29.jpg",
  },
  "Giant Muskie": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://images.unsplash.com/photo-1578645510380-6192f3ee2c0e?w=800&q=80",
  },
  "Enchanted Highway": {
    sourceUrl: "https://www.roadsideamerica.com/story/80522",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Geese_in_Flight_sculpture.jpg/800px-Geese_in_Flight_sculpture.jpg",
  },
  "World's Largest Peanut": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://images.unsplash.com/photo-1608797178972-2a214414f77e?w=800&q=80",
  },
  "Muffler Man (Uncle Sam)": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=800&q=80",
  },
  "Salem Witch Trial Memorial": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Salem_Witch_Trials_Memorial.jpg/800px-Salem_Witch_Trials_Memorial.jpg",
  },
  "World's Largest Rubber Stamp": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Free_Stamp_Cleveland.jpg/800px-Free_Stamp_Cleveland.jpg",
  },
  "Giant Peanut (Mr. Peanut)": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://images.unsplash.com/photo-1608797178972-2a214414f77e?w=800&q=80",
  },
  "World's Largest Cuckoo Clock": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&q=80",
  },
  "World's Largest Stiletto": {
    sourceUrl: "https://www.roadsideamerica.com/tip/12345",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Shoe_Philadelphia_Art_Museum.jpg/800px-Shoe_Philadelphia_Art_Museum.jpg",
  },
  "Ivanpah Solar Electric Generating System": {
    sourceUrl: "https://www.youtube.com/results?search_query=IVANPAH+coolryanfilms",
    imageUrl: "https://img.youtube.com/vi/rTOzGdAfLPk/hqdefault.jpg",
  },
} as const;

const SAMPLE_ATTRACTIONS: SeedAttraction[] = [
  { name: "World's Largest Ball of Twine", city: "Cawker City", state: "KS", description: "A massive ball of twine started by Frank Stoeber in 1953. Visitors can add their own twine.", latitude: 39.5092, longitude: -98.4334, address: "Main St, Cawker City, KS", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", sourceUrl: "https://www.roadsideamerica.com/story/8543" },
  { name: "Cadillac Ranch", city: "Amarillo", state: "TX", description: "Ten Cadillacs half-buried nose-down in a wheat field. Bring spray paint—graffiti is encouraged.", latitude: 35.1850, longitude: -101.9898, address: "I-40 Frontage Rd, Amarillo, TX", imageUrl: ROADSIDE_AMERICA["Cadillac Ranch"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Cadillac Ranch"].sourceUrl },
  { name: "Mystery Spot", city: "Santa Cruz", state: "CA", description: "Gravity-defying cabin and optical illusions. Balls roll uphill; visitors lean at impossible angles.", latitude: 37.0166, longitude: -121.9769, address: "465 Mystery Spot Rd, Santa Cruz, CA", imageUrl: ROADSIDE_AMERICA["Mystery Spot"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Mystery Spot"].sourceUrl },
  { name: "Newport Beach Pirate House", city: "Newport Beach", state: "CA", description: "A house built to look like a pirate ship, complete with bow, mast, and nautical details. A beloved roadside oddity on the Balboa Peninsula.", latitude: 33.6064, longitude: -117.9292, imageUrl: ROADSIDE_AMERICA["Newport Beach Pirate House"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Newport Beach Pirate House"].sourceUrl },
  { name: "Salem Sue", city: "New Salem", state: "ND", description: "World's largest Holstein cow statue. Visible from I-94, standing 38 feet tall.", latitude: 46.8433, longitude: -101.4119, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Salem_Sue_World%27s_Largest_Holstein_Cow.jpg/800px-Salem_Sue_World%27s_Largest_Holstein_Cow.jpg", sourceUrl: "https://www.roadsideamerica.com/tip/2660" },
  { name: "Paul Bunyan and Babe the Blue Ox", city: "Bemidji", state: "MN", description: "Giant statues of the lumberjack and his ox. A classic roadside photo op since 1937.", latitude: 47.4736, longitude: -94.8803, address: "Paul Bunyan Dr, Bemidji, MN", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Paul_Bunyan_and_Babe_the_Blue_Ox_-_Bemidji%2C_Minnesota.jpg/800px-Paul_Bunyan_and_Babe_the_Blue_Ox_-_Bemidji%2C_Minnesota.jpg", sourceUrl: "https://www.roadsideamerica.com/story/2031" },
  { name: "Spam Museum", city: "Austin", state: "MN", description: "Museum dedicated to Spam canned meat. Free admission, interactive exhibits, and a gift shop.", latitude: 43.6666, longitude: -92.9746, address: "101 3rd Ave NE, Austin, MN", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Spam_Museum_%28Austin%2C_MN%29.jpg/800px-Spam_Museum_%28Austin%2C_MN%29.jpg", sourceUrl: "https://www.roadsideamerica.com/story/2031" },
  { name: "Carhenge", city: "Alliance", state: "NE", description: "Stonehenge replica made from vintage cars. Gray-painted cars arranged in a circle.", latitude: 42.1253, longitude: -102.8713, address: "Carhenge Rd, Alliance, NE", imageUrl: ROADSIDE_AMERICA["Carhenge"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Carhenge"].sourceUrl },
  { name: "World's Largest Thermometer", city: "Baker", state: "CA", description: "134-foot thermometer in the desert. Built to celebrate the area's record heat.", latitude: 35.2653, longitude: -116.0753, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/World%27s_Largest_Thermometer_-_Baker%2C_CA.jpg/800px-World%27s_Largest_Thermometer_-_Baker%2C_CA.jpg", sourceUrl: "https://www.roadsideamerica.com/location/ca" },
  { name: "Lucy the Elephant", city: "Margate City", state: "NJ", description: "Six-story elephant-shaped building. National Historic Landmark; tours available.", latitude: 39.3418, longitude: -74.5032, address: "9200 Atlantic Ave, Margate City, NJ", imageUrl: ROADSIDE_AMERICA["Lucy the Elephant"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Lucy the Elephant"].sourceUrl },
  { name: "Fremont Troll", city: "Seattle", state: "WA", description: "Giant troll sculpture under the Aurora Bridge. Crushing a real VW Beetle.", latitude: 47.6510, longitude: -122.3473, address: "N 36th St, Seattle, WA", imageUrl: ROADSIDE_AMERICA["Fremont Troll"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Fremont Troll"].sourceUrl },
  { name: "World's Largest Pistachio", city: "Alamogordo", state: "NM", description: "30-foot pistachio statue at a nut farm. Part of McGinn's PistachioTree Ranch.", latitude: 32.8998, longitude: -105.9603, imageUrl: ROADSIDE_AMERICA["World's Largest Pistachio"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Pistachio"].sourceUrl },
  { name: "Foamhenge", city: "Natural Bridge", state: "VA", description: "Full-size Stonehenge replica made of foam. Same dimensions as the original.", latitude: 37.6276, longitude: -79.5439, imageUrl: ROADSIDE_AMERICA["Foamhenge"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Foamhenge"].sourceUrl },
  { name: "Giant Muskie", city: "Hayward", state: "WI", description: "Huge fiberglass muskie statue. Weighs thousands of pounds; symbol of the area.", latitude: 46.0130, longitude: -91.4849, imageUrl: ROADSIDE_AMERICA["Giant Muskie"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Muskie"].sourceUrl },
  { name: "Corn Palace", city: "Mitchell", state: "SD", description: "Building decorated with murals made of corn. Designs change annually.", latitude: 43.7094, longitude: -98.0298, address: "604 N Main St, Mitchell, SD", imageUrl: ROADSIDE_AMERICA["Corn Palace"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Corn Palace"].sourceUrl },
  { name: "Enchanted Highway", city: "Regent", state: "ND", description: "32-mile stretch with giant scrap metal sculptures. Geese in Flight, Tin Family, and more.", latitude: 46.4211, longitude: -102.5521, imageUrl: ROADSIDE_AMERICA["Enchanted Highway"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Enchanted Highway"].sourceUrl },
  { name: "World's Largest Catsup Bottle", city: "Collinsville", state: "IL", description: "170-foot water tower shaped like a ketchup bottle. Restored by community effort.", latitude: 38.6703, longitude: -89.9845, imageUrl: ROADSIDE_AMERICA["World's Largest Catsup Bottle"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Catsup Bottle"].sourceUrl },
  { name: "Salvation Mountain", city: "Niland", state: "CA", description: "Colorful folk art mountain in the desert. Built by Leonard Knight with adobe and paint.", latitude: 33.2522, longitude: -115.4753, imageUrl: ROADSIDE_AMERICA["Salvation Mountain"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Salvation Mountain"].sourceUrl },
  { name: "World's Largest Peanut", city: "Ashburn", state: "GA", description: "Giant peanut monument. Celebrates the peanut capital of the world.", latitude: 31.7060, longitude: -83.6532, imageUrl: ROADSIDE_AMERICA["World's Largest Peanut"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Peanut"].sourceUrl },
  { name: "Giant Paul Bunyan", city: "Bangor", state: "ME", description: "31-foot statue of Paul Bunyan. Holding an axe and a peavey.", latitude: 44.8012, longitude: -68.7778, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Paul_Bunyan_statue%2C_Bangor%2C_Maine.jpg/800px-Paul_Bunyan_statue%2C_Bangor%2C_Maine.jpg", sourceUrl: "https://www.roadsideamerica.com/story/11266" },
  { name: "Paul Bunyan", city: "Portland", state: "OR", description: "31-foot concrete and metal statue in the Kenton neighborhood. Built in 1959 for Oregon's centennial; commissioned by the Kenton Businessmen's Association. On the National Register of Historic Places. Stands at N. Interstate Ave and N. Denver Ave.", latitude: 45.5838, longitude: -122.6861, address: "8436 N Denver Ave, Portland, OR", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Paul_Bunyan_Portland.jpg/800px-Paul_Bunyan_Portland.jpg", sourceUrl: "https://www.roadsideamerica.com/tip/2557" },
  { name: "Cabazon Dinosaurs", city: "Cabazon", state: "CA", description: "Giant dinosaur statues visible from I-10. Dinny the dinosaur and a T-rex; gift shop inside.", latitude: 33.9172, longitude: -116.7870, address: "50770 Seminole Dr, Cabazon, CA", imageUrl: ROADSIDE_AMERICA["Cabazon Dinosaurs"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Cabazon Dinosaurs"].sourceUrl },
  { name: "World's Largest Buffalo", city: "Jamestown", state: "ND", description: "26-foot-tall concrete buffalo statue. Stands at the entrance to the National Buffalo Museum.", latitude: 46.9102, longitude: -98.7084, imageUrl: ROADSIDE_AMERICA["World's Largest Buffalo"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Buffalo"].sourceUrl },
  { name: "Barstow Station McDonald's", city: "Barstow", state: "CA", description: "Route 66 McDonald's inside a vintage train car and depot. Classic roadside stop with railroad memorabilia and a retro dining car.", latitude: 34.8958, longitude: -117.0173, address: "685 N 1st Ave, Barstow, CA", imageUrl: ROADSIDE_AMERICA["Barstow Station McDonald's"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Barstow Station McDonald's"].sourceUrl },
  { name: "Blue Whale of Catoosa", city: "Catoosa", state: "OK", description: "Giant blue whale structure on Route 66. Built as a surprise anniversary gift; now a swimming hole landmark.", latitude: 36.1881, longitude: -95.7458, imageUrl: ROADSIDE_AMERICA["Blue Whale of Catoosa"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Blue Whale of Catoosa"].sourceUrl },
  { name: "World's Largest Fork", city: "Springfield", state: "MO", description: "35-foot fork standing beside a restaurant. Made of stainless steel.", latitude: 37.2153, longitude: -93.2982, imageUrl: ROADSIDE_AMERICA["World's Largest Fork"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Fork"].sourceUrl },
  { name: "Jolly Green Giant", city: "Blue Earth", state: "MN", description: "55-foot statue of the Green Giant. Visible from I-90; photo op with the iconic figure.", latitude: 43.6377, longitude: -94.1022, imageUrl: ROADSIDE_AMERICA["Jolly Green Giant"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Jolly Green Giant"].sourceUrl },
  { name: "World's Largest Ball of Paint", city: "Alexandria", state: "IN", description: "A baseball coated with thousands of layers of paint. Visitors can add a layer.", latitude: 40.2628, longitude: -85.6761, imageUrl: ROADSIDE_AMERICA["World's Largest Ball of Paint"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Ball of Paint"].sourceUrl },
  { name: "Giant Coffee Pot", city: "Bedford", state: "PA", description: "Historic roadside coffee pot building. Built in 1927 as a diner.", latitude: 40.0187, longitude: -78.5036, imageUrl: ROADSIDE_AMERICA["Giant Coffee Pot"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Coffee Pot"].sourceUrl },
  { name: "World's Largest Pecan", city: "Seguin", state: "TX", description: "Giant pecan statue. Celebrates the area's pecan industry.", latitude: 29.5688, longitude: -97.9647, imageUrl: ROADSIDE_AMERICA["World's Largest Pecan"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Pecan"].sourceUrl },
  { name: "Muffler Man (Uncle Sam)", city: "Las Vegas", state: "NV", description: "Giant fiberglass Uncle Sam holding a hot dog. Classic roadside statue.", latitude: 36.1699, longitude: -115.1398, imageUrl: ROADSIDE_AMERICA["Muffler Man (Uncle Sam)"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Muffler Man (Uncle Sam)"].sourceUrl },
  { name: "World's Largest Frying Pan", city: "Long Beach", state: "WA", description: "Giant frying pan. Part of the town's annual Razor Clam Festival history.", latitude: 46.3521, longitude: -124.0543, imageUrl: ROADSIDE_AMERICA["World's Largest Frying Pan"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Frying Pan"].sourceUrl },
  { name: "Giant Abraham Lincoln", city: "Dixon", state: "IL", description: "Statue of young Lincoln. Lincoln grew up in the area; statue depicts him as a rail-splitter.", latitude: 41.8436, longitude: -89.4815, imageUrl: ROADSIDE_AMERICA["Giant Abraham Lincoln"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Abraham Lincoln"].sourceUrl },
  { name: "World's Largest Mailbox", city: "Casey", state: "IL", description: "Oversized mailbox. One of several 'world's largest' items in the town of Casey.", latitude: 39.2992, longitude: -87.9925, imageUrl: ROADSIDE_AMERICA["World's Largest Mailbox"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Mailbox"].sourceUrl },
  { name: "Salem Witch Trial Memorial", city: "Salem", state: "MA", description: "Memorial to those accused in the witch trials. Solemn stone benches with victims' names.", latitude: 42.5218, longitude: -70.8967, imageUrl: ROADSIDE_AMERICA["Salem Witch Trial Memorial"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Salem Witch Trial Memorial"].sourceUrl },
  { name: "World's Largest Rubber Stamp", city: "Cleveland", state: "OH", description: "Giant rubber stamp sculpture. Part of the city's public art collection.", latitude: 41.5055, longitude: -81.6813, imageUrl: ROADSIDE_AMERICA["World's Largest Rubber Stamp"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Rubber Stamp"].sourceUrl },
  { name: "Giant Peanut (Mr. Peanut)", city: "Suffolk", state: "VA", description: "Giant Mr. Peanut statue. Planters Peanuts was founded nearby.", latitude: 36.7282, longitude: -76.5836, imageUrl: ROADSIDE_AMERICA["Giant Peanut (Mr. Peanut)"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Peanut (Mr. Peanut)"].sourceUrl },
  { name: "World's Largest Cuckoo Clock", city: "Sugarcreek", state: "OH", description: "Giant cuckoo clock that chimes. Swiss-themed town attraction.", latitude: 40.5034, longitude: -81.6410, imageUrl: ROADSIDE_AMERICA["World's Largest Cuckoo Clock"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Cuckoo Clock"].sourceUrl },
  { name: "World's Largest Stiletto", city: "Philadelphia", state: "PA", description: "Giant high-heel shoe sculpture. Part of the city's quirky public art.", latitude: 39.9526, longitude: -75.1652, imageUrl: ROADSIDE_AMERICA["World's Largest Stiletto"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Stiletto"].sourceUrl },
  { name: "Giant Lobster", city: "Boothbay", state: "ME", description: "Huge lobster statue. Celebrates Maine's lobster industry.", latitude: 43.8765, longitude: -69.6337, imageUrl: ROADSIDE_AMERICA["Giant Lobster"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Lobster"].sourceUrl },
  { name: "Trolls: Guardians of the Seeds", city: "Boothbay Harbor", state: "ME", description: "Five giant trolls made of recycled wood by artist Thomas Dambo. Created in a two-year, $500,000 collaboration. The sculptures are nestled along hidden paths at Coastal Maine Botanical Gardens, inviting visitors on a hunt to catch a glimpse. The sculptures have Danish names related to the forest, and expand Dambo's collection of 80 trolls found worldwide.", latitude: 43.8486, longitude: -69.6256, address: "105 Botanical Gardens Drive, Boothbay Harbor, ME", imageUrl: ROADSIDE_AMERICA["Trolls: Guardians of the Seeds"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Trolls: Guardians of the Seeds"].sourceUrl },
  { name: "World's Largest Chest of Drawers", city: "High Point", state: "NC", description: "Giant bureau (dresser) building. High Point is the furniture capital.", latitude: 35.9557, longitude: -80.0053, imageUrl: ROADSIDE_AMERICA["World's Largest Chest of Drawers"].imageUrl, sourceUrl: ROADSIDE_AMERICA["World's Largest Chest of Drawers"].sourceUrl },
  { name: "Giant Penguin", city: "Cut Bank", state: "MT", description: "27-foot penguin statue. 'Coldest spot in the nation' landmark.", latitude: 48.6333, longitude: -112.3333, imageUrl: ROADSIDE_AMERICA["Giant Penguin"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Giant Penguin"].sourceUrl },
  { name: "Eddie World", city: "Yermo", state: "CA", description: "Giant roadside candy store and gas station on I-15. Colorful building, huge candy selection, and a desert landmark between Barstow and Las Vegas.", latitude: 34.9050, longitude: -116.8231, address: "35662 Yermo Rd, Yermo, CA", imageUrl: ROADSIDE_AMERICA["Eddie World"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Eddie World"].sourceUrl },
  { name: "Lake Dolores Waterpark", city: "Newberry Springs", state: "CA", description: "The Lake Dolores Waterpark (\"Fun spot of the desert\") opened in 1962, was abandoned in 2004, and has been transformed with spray paint into an unofficial guerrilla art park. The rides have been dismantled. Post-apocalyptic culture in the desert.", latitude: 34.8550, longitude: -116.6889, address: "Hacienda Rd, Newberry Springs, CA", imageUrl: ROADSIDE_AMERICA["Lake Dolores Waterpark"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Lake Dolores Waterpark"].sourceUrl },
  { name: "Alien Fresh Jerky", city: "Baker", state: "CA", description: "Extraterrestrial dried meat -- alien or human? Worth a look at the bug-eyed outdoor decorations. UFO-themed jerky shop near I-15 with alien cowboy, crashed UFOs, and quirky fortune tellers.", latitude: 35.2653, longitude: -116.0753, address: "72242 Baker Blvd, Baker, CA", imageUrl: ROADSIDE_AMERICA["Alien Fresh Jerky"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Alien Fresh Jerky"].sourceUrl },
  { name: "Goldwell Open Air Museum", city: "Rhyolite", state: "NV", description: "Outdoor sculpture park near the ghost town of Rhyolite. Founded in 1984 by Belgian artist Albert Szukalski; features The Last Supper and Lady Desert: The Venus of Nevada. Free, open 24/7.", latitude: 36.9022, longitude: -116.8297, address: "Hwy 374, Rhyolite, NV", imageUrl: ROADSIDE_AMERICA["Goldwell Open Air Museum"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Goldwell Open Air Museum"].sourceUrl },
  { name: "Car Forest", city: "Goldfield", state: "NV", description: "Over 40 cars, trucks, vans, and buses have been buried nose-down, or stacked atop each other, along a dirt road in the desert. Created by Mark Rippie and Chad Sorg in 2002. International Car Forest of the Last Church. Free, open 24/7.", latitude: 37.7085, longitude: -117.2358, address: "Crystal Ave., Goldfield, NV", imageUrl: ROADSIDE_AMERICA["Car Forest"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Car Forest"].sourceUrl },
  { name: "Gas Works Park", city: "Seattle", state: "WA", description: "Park on the site of a former coal gasification plant. Industrial towers and machinery stand as ruins; some structures are part of a children's play barn. Kite-flying hill with sundial, picnic areas, and views of Lake Union and the Seattle skyline. Designed by Richard Haag; opened 1975.", latitude: 47.6460, longitude: -122.3340, address: "2101 N Northlake Way, Seattle, WA", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Gas_Works_Park%2C_Seattle%2C_Washington%2C_USA.jpg/800px-Gas_Works_Park%2C_Seattle%2C_Washington%2C_USA.jpg" },
  { name: "Gospodor Monument Park", city: "Toledo", state: "WA", description: "Towering metal columns along I-5 once supported sculptures commemorating the Holocaust, Native Americans (Chief Seattle), and Christianity (Mother Teresa). Created in 2002 by Dominic Gospodor. Creator died in 2010; monuments now preserved by the city of Toledo.", latitude: 46.4561, longitude: -122.8839, address: "370 Camus Rd, Toledo, WA", imageUrl: ROADSIDE_AMERICA["Gospodor Monument Park"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Gospodor Monument Park"].sourceUrl },
  { name: "Ivanpah Solar Electric Generating System", city: "Ivanpah", state: "CA", description: "World's largest concentrating solar power plant in the Mojave Desert. Three 450-foot towers surrounded by hundreds of thousands of mirrors that focus sunlight to create steam and generate electricity. Visible from I-15 between Las Vegas and Los Angeles, near Primm.", latitude: 35.57, longitude: -115.47, address: "Mojave Desert, San Bernardino County, CA", imageUrl: ROADSIDE_AMERICA["Ivanpah Solar Electric Generating System"].imageUrl, sourceUrl: ROADSIDE_AMERICA["Ivanpah Solar Electric Generating System"].sourceUrl },
];

const CATEGORIES = [
  { name: "Big Things", slug: "big-things", icon: "🗿" },
  { name: "Muffler Man", slug: "muffler-man", icon: "🦺" },
  { name: "Museums", slug: "museums", icon: "🏛️" },
  { name: "Mystery Spots", slug: "mystery-spots", icon: "🌀" },
  { name: "Roadside Oddities", slug: "roadside-oddities", icon: "🚗" },
  { name: "Statues", slug: "statues", icon: "🗽" },
  { name: "World's Largest", slug: "worlds-largest", icon: "📏" },
];

async function main() {
  console.log("Seeding categories...");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
  }

  const bigThings = await prisma.category.findUnique({ where: { slug: "big-things" } });
  const worldsLargest = await prisma.category.findUnique({ where: { slug: "worlds-largest" } });
  const oddities = await prisma.category.findUnique({ where: { slug: "roadside-oddities" } });

  console.log("Seeding attractions...");
  const catId = worldsLargest?.id ?? oddities?.id ?? bigThings?.id ?? "";
  for (const a of SAMPLE_ATTRACTIONS) {
    const existing = await prisma.attraction.findFirst({
      where: { name: a.name, state: a.state },
    });
    const imageUrl = a.imageUrl ?? undefined;
    const sourceUrl = a.sourceUrl ?? undefined;
    if (existing) {
      if (imageUrl || sourceUrl) {
        await prisma.attraction.update({
          where: { id: existing.id },
          data: { ...(imageUrl && { imageUrl }), ...(sourceUrl && { sourceUrl }) },
        });
      }
    } else if (catId) {
      const att = await prisma.attraction.create({
        data: {
          name: a.name,
          city: a.city,
          state: a.state,
          description: a.description,
          latitude: a.latitude,
          longitude: a.longitude,
          address: a.address ?? undefined,
          imageUrl,
          sourceUrl,
        },
      });
      await prisma.attractionCategory.create({
        data: { attractionId: att.id, categoryId: catId },
      });
    }
  }

  // Dedupe: keep one World's Largest Thermometer (Baker, CA), remove extras
  const thermometers = await prisma.attraction.findMany({
    where: { name: "World's Largest Thermometer", state: "CA" },
    orderBy: { createdAt: "asc" },
  });
  if (thermometers.length > 1) {
    const [, ...remove] = thermometers;
    for (const att of remove) {
      await prisma.attraction.delete({ where: { id: att.id } });
    }
    console.log(`Deduped World's Largest Thermometer: kept 1, removed ${remove.length}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
