/**
 * Import Maine roadside attractions from a static list.
 * Run from server: npx tsx scripts/import-maine-attractions.ts
 */

import { PrismaClient } from "@prisma/client";

const STATE = "ME";

const ACTIVE: { city: string; name: string }[] = [
  { city: "Alfred", name: "Where Old Bet the Elephant was Killed" },
  { city: "Arundel", name: "Maine Classic Car Museum" },
  { city: "Augusta", name: "Statue of America's Little Ambassador" },
  { city: "Bangor", name: "31-Foot-Tall Paul Bunyan" },
  { city: "Bangor", name: "Cole Land Transportation Museum" },
  { city: "Bangor", name: "Duck of Justice" },
  { city: "Bangor", name: "Scroll and Shield from USS Maine" },
  { city: "Bangor", name: "Stephen King Tours" },
  { city: "Bangor", name: "Stephen King's House" },
  { city: "Bangor", name: "VP Hannibal Hamlin's Death Couch" },
  { city: "Bangor", name: "Weird Water Tower from It" },
  { city: "Bath", name: "Monster of Unfathomable Pedigree" },
  { city: "Belfast", name: "Perry's Nut House" },
  { city: "Belfast", name: "Pink Floyd, Pink Dinosaur Skeleton" },
  { city: "Belfast", name: "Rooftop Elephant" },
  { city: "Belgrade", name: "Large Mosquito" },
  { city: "Bethel", name: "Earth's Five Largest Moon Meteorites" },
  { city: "Boothbay Harbor", name: "Captain Brown: Giant Old Salt Fisherman" },
  { city: "Boothbay Harbor", name: "Trolls: Guardians of the Seeds" },
  { city: "Brewer", name: "Underground Railroad Manhole" },
  { city: "Bridgewater", name: "Solar System Model: Uranus" },
  { city: "Brunswick", name: "The Swinging Bridge" },
  { city: "Brunswick", name: "The Vision of Uncle Tom" },
  { city: "Bryant Pond", name: "Three-Story Outhouse" },
  { city: "Bryant Pond", name: "World's Largest Telephone" },
  { city: "Bucksport", name: "Colonel Buck's Cursed Tomb" },
  { city: "Cape Elizabeth", name: "1886 Shipwreck at the Head Light" },
  { city: "Casco", name: "Presidents Signpost" },
  { city: "Columbia Falls", name: "Lindbergh Crate" },
  { city: "Columbia Falls", name: "Wild Blueberry Land: World's Largest Blueberry" },
  { city: "Coopers Mills", name: "Elmer's Barn of Junk and Dead Things" },
  { city: "Cushing", name: "Langlais Sculpture Preserve" },
  { city: "Deer Isle", name: "Nervous Nellie's: Where Jam is Made" },
  { city: "Dennysville", name: "The Most Absurd Bar in the World: A Sculpture" },
  { city: "Eastport", name: "Bear Head Rock" },
  { city: "Eastport", name: "Big Fisherman and Fish" },
  { city: "Eastport", name: "Nerida the Mermaid" },
  { city: "Eastport", name: "Outdoor Musical Instruments" },
  { city: "Edgecomb", name: "Wayward London Phone Booth" },
  { city: "Ellsworth", name: "Telephone Museum" },
  { city: "Farmington", name: "Birthplace of Earmuffs" },
  { city: "Fort Kent", name: "America's First Mile" },
  { city: "Freeport", name: "Desert of Maine" },
  { city: "Freeport", name: "Giant L.L. Bean Boot" },
  { city: "Freeport", name: "McDonald's in a House" },
  { city: "Freeport", name: "The Big F Indian" },
  { city: "Fryeburg", name: "Jockey Cap Rock, Robert Peary Monument" },
  { city: "Greenville", name: "B-52 Crash Wreckage and Memorial" },
  { city: "Hancock", name: "Large Fiberglass Lobster" },
  { city: "Hancock", name: "Pet Sematary Movie House" },
  { city: "Hancock", name: "Ray Murphy's Chainsaw Art" },
  { city: "Hinckley", name: "Hemingway's Marlin and Other Oddities" },
  { city: "Hodgdon", name: "Shoe Tree" },
  { city: "Holden", name: "Big Cone, Vacationland Mural" },
  { city: "Houghton", name: "Angel Falls" },
  { city: "Houlton", name: "Boy and the Boot" },
  { city: "Houlton", name: "Crossroads of US 1 and 2" },
  { city: "Houlton", name: "Solar System Model: Pluto" },
  { city: "Jefferson", name: "Jefferson Cattle Pound" },
  { city: "Kakadjo", name: "Rare Maine Billboard" },
  { city: "Kenduskeag", name: "Hand-Painted Big Coke Can" },
  { city: "Kennebunkport", name: "Blowing Cave, Dolphin Tree Carving" },
  { city: "Kennebunkport", name: "George and Barbara Bush Bench" },
  { city: "Kennebunkport", name: "Seashore Trolley Museum" },
  { city: "Kennebunk", name: "Wedding Cake House" },
  { city: "Kingfield", name: "Stanley Museum: Steam Cars" },
  { city: "Kittery", name: "Big Easy Chair" },
  { city: "Kittery", name: "Store Decorated with Animal Heads" },
  { city: "Lewiston", name: "Big Hammer and Nails" },
  { city: "Lewiston", name: "Muhammad Ali Statue" },
  { city: "Liberty", name: "Only Octagonal Post Office" },
  { city: "Lincoln", name: "13-Foot-Long Loon" },
  { city: "Lubec", name: "Easternmost Point in the U.S." },
  { city: "Lubec", name: "Water Junk Art" },
  { city: "Lynchville", name: "World Traveler Signpost" },
  { city: "Madawaska", name: "Shrine to Long Distance Bikers" },
  { city: "Manchester", name: "Devil's Footprint" },
  { city: "Monmouth", name: "Big Farmyard Rooster" },
  { city: "Moscow", name: "Retaining Wall of Birdhouses" },
  { city: "New Portland", name: "Wire Suspension Bridge" },
  { city: "Newcastle", name: "Historic Fish Ladder" },
  { city: "Orr's Island", name: "The Cribstone Bridge" },
  { city: "Owl's Head", name: "Owls Head Transportation Museum" },
  { city: "Peaks Island", name: "Umbrella Cover Museum" },
  { city: "Pembroke", name: "Reversing Falls" },
  { city: "Perry", name: "45th Parallel Gift Shop Globe" },
  { city: "Perry", name: "Oldest Halfway North Marker" },
  { city: "Phillips", name: "Light of the World Cross" },
  { city: "Pittsfield", name: "World's Largest Non-Stick Frying Pan" },
  { city: "Portland", name: "Berlin Wall Slabs" },
  { city: "Portland", name: "Director John Ford Statue" },
  { city: "Portland", name: "International Cryptozoology Museum" },
  { city: "Portland", name: "Lobsterman Statue" },
  { city: "Portland", name: "Maine Narrow Gauge Railroad and Museum" },
  { city: "Portland", name: "Slugger the Seadog" },
  { city: "Presque Isle", name: "Big Milk Carton" },
  { city: "Presque Isle", name: "Solar System Model: Earth" },
  { city: "Presque Isle", name: "Solar System Model: Mercury" },
  { city: "Presque Isle", name: "Solar System Model: The Sun" },
  { city: "Presque Isle", name: "Solar System Model: Venus" },
  { city: "Presque Isle", name: "Transatlantic Balloon Monument" },
  { city: "Prospect Harbor", name: "Big Jim the Fisherman" },
  { city: "Prospect", name: "Penobscot Narrows Bridge Observatory, Fort Knox Tunnels" },
  { city: "Rangeley", name: "Wilhelm Reich Museum: Cloudbusters!" },
  { city: "Rockland", name: "Big Metal Lobster" },
  { city: "Rockland", name: "El Faro Memorial: Sailor Ghosts" },
  { city: "Rockport", name: "Andre the Seal Statue" },
  { city: "Rockport", name: "Birthplace of the Inventor of the Doughnut Hole" },
  { city: "Rockwood", name: "Flying Moose Statue" },
  { city: "Rumford", name: "Babe the Blue Ox" },
  { city: "Rumford", name: "Muffler Man - Paul Bunyan" },
  { city: "Saint George", name: "Center of the Universe" },
  { city: "Saint George", name: "St. George vs. Dragon" },
  { city: "Scarborough", name: "Lenny the Chocolate Moose" },
  { city: "Searsport", name: "Alexander the Dead Seagull" },
  { city: "Skowhegan", name: "Langlais Sculptures: Girl With A Tail" },
  { city: "Skowhegan", name: "World's Tallest Indian" },
  { city: "South China", name: "World Traveler Signpost" },
  { city: "South Paris", name: "Museum in a Jail" },
  { city: "Stonington", name: "Mini Village" },
  { city: "Thomaston", name: "Prison Gift Shop" },
  { city: "Trenton", name: "The Great Maine Lumberjack Show" },
  { city: "Trenton", name: "Wentworth's Tired Iron Art" },
  { city: "Union", name: "Moxie Bottle House" },
  { city: "Van Buren", name: "Maine Tribute Moose" },
  { city: "Waldoboro", name: "Fawcett's Antique Toy Museum" },
  { city: "Waldoboro", name: "Recycleart" },
  { city: "Wells", name: "Johnson Hall Museum, One Man's Treasures" },
  { city: "Westbrook", name: "Rudy Vallee Bronze Head" },
  { city: "Westbrook", name: "Walking Man" },
  { city: "Wilton", name: "Life-Size Maine Giantess" },
  { city: "Woolwich", name: "Mainer C. Lobster Sculpture" },
  { city: "Yarmouth", name: "Eartha: World's Largest Rotating Globe" },
  { city: "York Beach", name: "York's Wild Kingdom" },
  { city: "York Harbor", name: "Candlemas Massacre Memorial" },
  { city: "York Harbor", name: "Confederate Yankee Statue" },
  { city: "York Harbor", name: "Pleasure Ground - Tiny Figures" },
  { city: "York Harbor", name: "Snowshoe Rock of Doom" },
  { city: "York Harbor", name: "Wiggly Bridge" },
];

const GONE: { city: string; name: string }[] = [
  { city: "Augusta", name: "Tony: Big Boyz Worker Statue" },
  { city: "Bath", name: "Lobstermobile" },
  { city: "Camden", name: "Large Doctor's Bag" },
  { city: "Dover-Foxcroft", name: "Enchanted Forest" },
  { city: "Ellsworth", name: "Big Eyeglasses" },
  { city: "Houlton", name: "7 Wonders of God Creatures" },
  { city: "Limerick", name: "Uncle Donald's Pig Farm" },
  { city: "Lisbon Falls", name: "Moxie Museum" },
  { city: "Lubec", name: "Sardine Museum" },
  { city: "Norway", name: "World Traveler Signpost" },
  { city: "Thorndike", name: "Doll Circus and Museum" },
  { city: "Union", name: "Scrap Metal Dragons, Blue Moose" },
  { city: "Vassalboro", name: "Grand View Topless Coffee Shop" },
  { city: "Wells", name: "Cheese Shop Shaped Like Cheese" },
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
        description: `Maine roadside attraction in ${city}.`,
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
        description: `Closed. Former Maine roadside attraction in ${city}.`,
      },
    });
    if (catId) {
      await prisma.attractionCategory.create({
        data: { attractionId: att.id, categoryId: catId },
      }).catch(() => {});
    }
    created++;
  }

  console.log(`Maine attractions: created ${created}, skipped (already exist) ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));