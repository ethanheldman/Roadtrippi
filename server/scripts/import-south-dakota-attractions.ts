/**
 * Import South Dakota roadside attractions from Roadside America list.
 * Run from server: npx tsx scripts/import-south-dakota-attractions.ts
 */

import { PrismaClient } from "@prisma/client";

const STATE = "SD";

const ACTIVE: { city: string; name: string }[] = [
  { city: "Aberdeen", name: "Storybook Land" },
  { city: "Belle Fourche", name: "Abandoned Shepherds Monument" },
  { city: "Belle Fourche", name: "Center of the Nation Monument" },
  { city: "Belle Fourche", name: "Center of the Nation: 50 States" },
  { city: "Box Elder", name: "South Dakota Air and Space Museum" },
  { city: "Brookings", name: "Weary Wil and Dirty Lil" },
  { city: "Buffalo", name: "Statues of Famous Horse and Wolf" },
  { city: "Cactus Flat", name: "Six-Ton Prairie Dog" },
  { city: "Canton", name: "Asylum for Indians Marker and Grave" },
  { city: "Chamberlain", name: "Big Pheasant Made of Railroad Spikes" },
  { city: "Chamberlain", name: "Dignity, Native American Giantess" },
  { city: "Colome", name: "Outhouse Museum of South Dakota" },
  { city: "Custer", name: "Bo the Bison: 37 Feet Tall" },
  { city: "Custer", name: "Buffalo Statues" },
  { city: "Custer", name: "Crazy Horse Memorial" },
  { city: "Custer", name: "Dino the Flintstones Dinosaur" },
  { city: "Custer", name: "Mini Dinosaur Park" },
  { city: "Custer", name: "Old Custer Jail" },
  { city: "Dallas", name: "Frank Day's Cowboy Museum" },
  { city: "De Smet", name: "Homestead Rock of Laura Ingalls Wilder" },
  { city: "Deadwood", name: "Adams Museum: Deadwood's Attic" },
  { city: "Deadwood", name: "Broken Boot Gold Mine" },
  { city: "Deadwood", name: "Brothel Deadwood" },
  { city: "Deadwood", name: "Celebrity Hotel: Relics on Display" },
  { city: "Deadwood", name: "Days of '76 Museum" },
  { city: "Deadwood", name: "Deadwood Model Trains" },
  { city: "Deadwood", name: "Deadwood: Signs and Wonders" },
  { city: "Deadwood", name: "Deadwood: Sin, Gold, Blood" },
  { city: "Deadwood", name: "Death Chair of Wild Bill Hickok" },
  { city: "Deadwood", name: "Graves of Wild Bill Hickok and Calamity Jane" },
  { city: "Deadwood", name: "Neon Tootsie the Coyote" },
  { city: "Deadwood", name: "Original Location of Saloon No. 10" },
  { city: "Deadwood", name: "Preacher Smith Monument" },
  { city: "Deadwood", name: "Sit with Drunk Calamity Jane" },
  { city: "Deadwood", name: "Sitting Bill" },
  { city: "Deadwood", name: "Teddy Roosevelt Friendship Tower" },
  { city: "Deadwood", name: "Wild Bill's Stone Head" },
  { city: "Deadwood", name: "World's 3rd Largest Bronze Sculpture" },
  { city: "Deadwood", name: "World's Largest Log Chair" },
  { city: "Elkton", name: "Hero the Elephant and the Heintz Airship" },
  { city: "Faith", name: "Scrap Metal T Rex" },
  { city: "Farmer", name: "St. Peter's Rock Grotto" },
  { city: "Fort Pierre", name: "Rodeo Champion Weather Vane" },
  { city: "Garretson", name: "Devil's Gulch: Jesse James Jumped Here" },
  { city: "Gregory", name: "Big Pheasant" },
  { city: "Harrisburg", name: "Abby Normal's Museum of the Strange" },
  { city: "Henry", name: "Big Pheasant Statue" },
  { city: "Henry", name: "Tiny Church for Travelers" },
  { city: "Hermosa", name: "Big President Heads" },
  { city: "Hermosa", name: "Madonna Of The Prairies" },
  { city: "Hill City", name: "30-Foot-Tall Smokey Bear" },
  { city: "Hill City", name: "Black Hills Institute - Dinosaurs" },
  { city: "Hill City", name: "Horse with Spoon Nose" },
  { city: "Hot Springs", name: "Future 50-Foot-Long Woolly Mammoth" },
  { city: "Hot Springs", name: "Kidney Springs 1922 Gazebo" },
  { city: "Hot Springs", name: "Mammoth Site: Indoor Boneyard" },
  { city: "Huron", name: "Dakotaland Museum" },
  { city: "Huron", name: "Merci Box Car" },
  { city: "Huron", name: "White Buffalo Statue" },
  { city: "Huron", name: "World's Largest Pheasant" },
  { city: "Interior", name: "Horse with Rushmore Heads" },
  { city: "Kadoka", name: "Whitetail Deer Made of Car Parts" },
  { city: "Keystone", name: "Beautiful Rushmore Cave" },
  { city: "Keystone", name: "Big Thunder Gold Mine" },
  { city: "Keystone", name: "Borglum Historical Center, Rushmore Borglum Story" },
  { city: "Keystone", name: "Clinton Rock" },
  { city: "Keystone", name: "Large Mt. Rushmore Chair" },
  { city: "Keystone", name: "Mount Rushmore" },
  { city: "Keystone", name: "National Presidential Wax Museum" },
  { city: "Keystone", name: "World's Largest Wooden Bigfoot" },
  { city: "Lead", name: "Mining Museum, Simulated Gold Mine" },
  { city: "Lead", name: "Open Pit Mine Hole" },
  { city: "Lemmon", name: "Cowboy Rides a Dinosaur" },
  { city: "Lemmon", name: "Hugh Glass Bear Battle Sculpture" },
  { city: "Lemmon", name: "Petrified Wood Park" },
  { city: "Lemmon", name: "Petrified Wood Park Museum" },
  { city: "Lemmon", name: "Scrap Metal Bronco Buster" },
  { city: "Lemmon", name: "Scrappy Art of John Lopez" },
  { city: "Madison", name: "Car Lot White Buffalo" },
  { city: "Milbank", name: "1880s Windmill" },
  { city: "Milbank", name: "The Monolith" },
  { city: "Miller", name: "Cattle on Poles" },
  { city: "Mitchell", name: "Corn Palace" },
  { city: "Mitchell", name: "Cornelius, Corn Palace Mascot" },
  { city: "Mitchell", name: "Prehistoric Indian Village" },
  { city: "Mitchell", name: "Thunder Bunny: Jackalope Jackrabbit" },
  { city: "Mobridge", name: "Cowboy Rides Giant Walleye" },
  { city: "Mobridge", name: "Disputed Grave of Sitting Bull" },
  { city: "Mobridge", name: "Fool Soldiers Monument" },
  { city: "Mobridge", name: "Klein Museum" },
  { city: "Montrose", name: "Porter Sculpture Park: Giant Bull Head" },
  { city: "Murdo", name: "Original 1880 Town" },
  { city: "Murdo", name: "Pioneer Auto Show Museum" },
  { city: "Murdo", name: "Skeleton Man Walking Skeleton Dinosaur" },
  { city: "Nemo", name: "Wonderland Cave" },
  { city: "Newell", name: "Sheep Capital of the Nation" },
  { city: "Oacoma", name: "Al's Oasis: Big Buffalo" },
  { city: "Oelrichs", name: "Skeletal Metal Rancher Monument" },
  { city: "Philip", name: "Minuteman Missile National Historic Site" },
  { city: "Philip", name: "Minuteman Missile Visitors Center" },
  { city: "Philip", name: "Prairie Dog Town At Gas Station" },
  { city: "Philip", name: "Scrap Metal Horse" },
  { city: "Pierre", name: "Golden Lady: a Mom-ument" },
  { city: "Pierre", name: "Governor # 1: Arthur Calvin Mellette" },
  { city: "Pierre", name: "Governor # 3: Andrew E. Lee" },
  { city: "Pierre", name: "Governor # 4: Charles Nelson Herreid" },
  { city: "Pierre", name: "Governor # 6: Coe I. Crawford" },
  { city: "Pierre", name: "Governor # 7: Robert Scadden Vessey" },
  { city: "Pierre", name: "Governor # 8: Frank M. Byrne" },
  { city: "Pierre", name: "Governor # 9: Peter Norbeck" },
  { city: "Pierre", name: "Governor #10: William H. McMaster" },
  { city: "Pierre", name: "Governor #12: William J. Bulow" },
  { city: "Pierre", name: "Governor #13: Warren Everett Green" },
  { city: "Pierre", name: "Governor #14: Thomas Matthew Berry" },
  { city: "Pierre", name: "Governor #15: Leslie Jensen" },
  { city: "Pierre", name: "Governor #17: Merrell Q. Sharpe" },
  { city: "Pierre", name: "Governor #19: Sigurd Anderson" },
  { city: "Pierre", name: "Governor #20: Joe Foss" },
  { city: "Pierre", name: "Governor #22: Archie Gubbrud" },
  { city: "Pierre", name: "Governor #24: Frank Leroy Farrar" },
  { city: "Pierre", name: "Governor #27: William John Janklow" },
  { city: "Pierre", name: "Governor #29: Walter Dale Miller" },
  { city: "Pierre", name: "Governor #30: Marion Michael Rounds" },
  { city: "Pierre", name: "Really Small Schoolhouse" },
  { city: "Pierre", name: "Saluting Soldiers" },
  { city: "Pierre", name: "South Dakota National Guard Museum" },
  { city: "Pierre", name: "Trail of Governors" },
  { city: "Pierre", name: "Wayward State Line Monument" },
  { city: "Pringle", name: "Bicycle Sculpture" },
  { city: "Rapid City", name: "12th Century Replica Church" },
  { city: "Rapid City", name: "America's Street Corner Presidents" },
  { city: "Rapid City", name: "Art Alley" },
  { city: "Rapid City", name: "Bear Country USA" },
  { city: "Rapid City", name: "Berlin Wall Segments" },
  { city: "Rapid City", name: "Black Hills Caverns" },
  { city: "Rapid City", name: "City of Presidents Info Center" },
  { city: "Rapid City", name: "Cosmos Mystery Area" },
  { city: "Rapid City", name: "Dakotah the Buffalo: Bonus Mini-Art" },
  { city: "Rapid City", name: "Dinosaur Park" },
  { city: "Rapid City", name: "Dinosaur of Old Ike Murphy" },
  { city: "Rapid City", name: "Prospector Statue Of Johnny One Feather" },
  { city: "Rapid City", name: "Putz-n-Glo Indoor Black Light Miniature Golf" },
  { city: "Rapid City", name: "Reptile Gardens" },
  { city: "Rapid City", name: "Spin a 4-Ton Rock" },
  { city: "Rapid City", name: "Statue # 1: George Washington" },
  { city: "Rapid City", name: "Statue # 2: John Adams" },
  { city: "Rapid City", name: "Statue # 3: Thomas Jefferson" },
  { city: "Rapid City", name: "Statue # 4: James Madison" },
  { city: "Rapid City", name: "Statue # 5: James Monroe" },
  { city: "Rapid City", name: "Statue # 6: John Quincy Adams" },
  { city: "Rapid City", name: "Statue # 7: Andrew Jackson" },
  { city: "Rapid City", name: "Statue # 8: Martin van Buren" },
  { city: "Rapid City", name: "Statue # 9: William Henry Harrison" },
  { city: "Rapid City", name: "Statue #10: John Tyler" },
  { city: "Rapid City", name: "Statue #11: James K. Polk" },
  { city: "Rapid City", name: "Statue #12: Zachary Taylor" },
  { city: "Rapid City", name: "Statue #13: Millard Fillmore" },
  { city: "Rapid City", name: "Statue #14: Franklin Pierce" },
  { city: "Rapid City", name: "Statue #15: James Buchanan" },
  { city: "Rapid City", name: "Statue #16: Abraham Lincoln" },
  { city: "Rapid City", name: "Statue #17: Andrew Johnson" },
  { city: "Rapid City", name: "Statue #18: Ulysses S. Grant" },
  { city: "Rapid City", name: "Statue #19: Rutherford B. Hayes" },
  { city: "Rapid City", name: "Statue #20: James Garfield" },
  { city: "Rapid City", name: "Statue #21: Chester A. Arthur" },
  { city: "Rapid City", name: "Statue #22, 24: Grover Cleveland" },
  { city: "Rapid City", name: "Statue #23: Benjamin Harrison" },
  { city: "Rapid City", name: "Statue #25: William McKinley" },
  { city: "Rapid City", name: "Statue #26: Teddy Roosevelt" },
  { city: "Rapid City", name: "Statue #27: William Howard Taft" },
  { city: "Rapid City", name: "Statue #28: Woodrow Wilson" },
  { city: "Rapid City", name: "Statue #29: Warren Harding" },
  { city: "Rapid City", name: "Statue #30: Calvin Coolidge" },
  { city: "Rapid City", name: "Statue #31: Herbert Hoover" },
  { city: "Rapid City", name: "Statue #32: Franklin D. Roosevelt" },
  { city: "Rapid City", name: "Statue #33: Harry S Truman" },
  { city: "Rapid City", name: "Statue #34: Dwight D. Eisenhower" },
  { city: "Rapid City", name: "Statue #35: John F. Kennedy" },
  { city: "Rapid City", name: "Statue #36: Lyndon B. Johnson" },
  { city: "Rapid City", name: "Statue #37: Richard Nixon" },
  { city: "Rapid City", name: "Statue #38: Gerald Ford" },
  { city: "Rapid City", name: "Statue #39: Jimmy Carter" },
  { city: "Rapid City", name: "Statue #40: Ronald Reagan" },
  { city: "Rapid City", name: "Statue #41: George Bush" },
  { city: "Rapid City", name: "Statue #42: Bill Clinton" },
  { city: "Rapid City", name: "Statue #43: George W. Bush" },
  { city: "Rapid City", name: "Statue #44: Barack Obama" },
  { city: "Rapid City", name: "Statue #45: Donald Trump" },
  { city: "Rapid City", name: "Storybook Island" },
  { city: "Rapid City", name: "World's Largest Quarter-Pounder" },
  { city: "Redfield", name: "Pheasant Statue at Pheasant Capital of the World" },
  { city: "Rockerville", name: "Rushmore Memorial Arches" },
  { city: "Roslyn", name: "International Vinegar Museum" },
  { city: "Scenic", name: "Ghost Town Named Scenic" },
  { city: "Scenic", name: "Pterodactyl Monument" },
  { city: "Shadehill", name: "Airplane Wind Vane" },
  { city: "Shadehill", name: "Hugh Glass Mauled by Bear Here" },
  { city: "Sioux Falls", name: "Bank Robbed by John Dillinger" },
  { city: "Sioux Falls", name: "Buffalo Ridge Ghost Town (1880 Cowboy Town)" },
  { city: "Sioux Falls", name: "Concrete Outline of USS South Dakota" },
  { city: "Sioux Falls", name: "Golden Pig on Two Legs" },
  { city: "Sioux Falls", name: "Large Cow" },
  { city: "Sioux Falls", name: "McKinley: First President to Visit South Dakota" },
  { city: "Sioux Falls", name: "Muffler Man: Mr. Bendo" },
  { city: "Sioux Falls", name: "Potato Man" },
  { city: "Sioux Falls", name: "Replica Statue of David" },
  { city: "Sioux Falls", name: "Tornado Beam, Teddy Roosevelt Car" },
  { city: "Sisseton", name: "Nicollet Tower: See Two Other States" },
  { city: "Stockholm", name: "Buggy Museum" },
  { city: "Sturgis", name: "Bear Butte" },
  { city: "Sturgis", name: "Buffalo Chip Sign and Big Motorcycle Motor" },
  { city: "Sturgis", name: "Large 44 Magnum" },
  { city: "Sturgis", name: "Mailman Scalped by Indians Here" },
  { city: "Sturgis", name: "Motorcycle Museum and Hall of Fame" },
  { city: "Sturgis", name: "Statue of the Superfast Cyclist" },
  { city: "Tyndall", name: "America's Oldest Eiffel Tower" },
  { city: "Vale", name: "Beer Mug Muffler Man" },
  { city: "Vale", name: "Flaming Biker with Chainsaw" },
  { city: "Valley Springs", name: "Stand on Three States: Iowa, Minnesota, South Dakota" },
  { city: "Vermillion", name: "Skull and Bones of Hero the Elephant" },
  { city: "Wall", name: "42-Foot-Tall Jackalope" },
  { city: "Wall", name: "Peer into a Missile Silo" },
  { city: "Wall", name: "Wall Drug Dinosaur" },
  { city: "Wall", name: "Wall Drug Store" },
  { city: "Wasta", name: "27-Foot Tall Buffalo Bill" },
  { city: "Wasta", name: "Armed Forces Museum" },
  { city: "Watertown", name: "Cowboy Statue" },
  { city: "Webster", name: "Shoe House, World's Largest Hairball" },
  { city: "Wessington Springs", name: "Replica Shakespeare House" },
  { city: "White Lake", name: "Rest Stop Tiny Church - Eastbound" },
  { city: "White Lake", name: "Rest Stop Tiny Church: Westbound" },
  { city: "Wounded Knee", name: "Wounded Knee Massacre Memorial" },
];

const GONE: { city: string; name: string }[] = [
  { city: "Brookings", name: "Metal Sculptures Park (Gone)" },
  { city: "Buffalo", name: "Buffalo and Bison - Not the Same (Gone)" },
  { city: "Custer", name: "Black Hills Holy Land (Gone)" },
  { city: "Custer", name: "Flintstones Bedrock City (Gone)" },
  { city: "Deadwood", name: "Boondocks 1950s Retro Complex (Gone)" },
  { city: "Deadwood", name: "Chinese Opium Tunnel (Gone)" },
  { city: "Deadwood", name: "The Roo Ranch (Gone)" },
  { city: "Hill City", name: "World's Largest Teddy Bear Collection (Gone)" },
  { city: "Kadoka", name: "Badlands Petrified Gardens (Gone)" },
  { city: "Lead", name: "Presidents Park (Gone)" },
  { city: "Mitchell", name: "Happy Chef (Gone)" },
  { city: "Mitchell", name: "Hot Air Ballooning Museum (Gone)" },
  { city: "Mitchell", name: "Valtiroty Shiloh's Tabernacle (Gone)" },
  { city: "Rapid City", name: "45-Foot-Tall Statue of Liberty (Gone)" },
  { city: "Rapid City", name: "America's Founding Fathers Exhibit (Gone)" },
  { city: "Rapid City", name: "Gas Station Taxidermy Museum (Gone)" },
  { city: "Rapid City", name: "Lawnmower Pile-Up (Gone)" },
  { city: "Rapid City", name: "Man Made From Tires (Gone)" },
  { city: "Rapid City", name: "Thunderhead Underground Falls (Gone)" },
  { city: "Roscoe", name: "Bernie Sanders Couch of the Future (Gone)" },
  { city: "Sioux Falls", name: "Badlands Pawn: 1 Million in Gold Bars (Gone)" },
  { city: "Wall", name: "Wild West Historical Wax Museum (Gone)" },
  { city: "Wall", name: "Yard Full of Animal Sculptures (Gone)" },
  { city: "Worthing", name: "Giant Pepsi Can (Gone)" },
];

async function main() {
  const prisma = new PrismaClient();

  const oddities = await prisma.category.findFirst({ where: { slug: "roadside-oddities" } });
  const bigThings = await prisma.category.findFirst({ where: { slug: "big-things" } });
  const catId = oddities?.id ?? bigThings?.id ?? null;

  let created = 0;
  let skipped = 0;

  for (const { city, name } of ACTIVE) {
    const existing = await prisma.attraction.findFirst({
      where: { name, state: STATE, city },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const att = await prisma.attraction.create({
      data: {
        name,
        city,
        state: STATE,
        description: `South Dakota roadside attraction in ${city}.`,
      },
    });
    if (catId) {
      await prisma.attractionCategory.create({
        data: { attractionId: att.id, categoryId: catId },
      }).catch(() => {});
    }
    created++;
  }

  for (const { city, name } of GONE) {
    const existing = await prisma.attraction.findFirst({
      where: { name, state: STATE, city },
    });
    if (existing) {
      skipped++;
      continue;
    }
    const att = await prisma.attraction.create({
      data: {
        name,
        city,
        state: STATE,
        description: `Closed. Former South Dakota roadside attraction in ${city}.`,
      },
    });
    if (catId) {
      await prisma.attractionCategory.create({
        data: { attractionId: att.id, categoryId: catId },
      }).catch(() => {});
    }
    created++;
  }

  console.log(`South Dakota attractions: created ${created}, skipped (already exist) ${skipped}.`);
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
