import { prisma } from "./db";

async function seed() {
  // Clear existing data
  await prisma.propertyUse.deleteMany();
  await prisma.property.deleteMany();

  // Create properties with property uses
  const properties = await Promise.all(
    ["Alpha Tower", "Beta Complex", "Gamma Plaza", "Delta Building", "Epsilon Center"].map(
      async (name) => {
        const property = await prisma.property.create({ 
          data: { name } 
        });

        // Create property uses for each property
        const uses = ["Residential", "Commercial", "Parking", "Storage", "Amenities"];
        await Promise.all(
          uses.map((use, index) =>
            prisma.propertyUse.create({
              data: {
                propertyId: property.id,
                name: use,
                unitCount: (index + 1) * 10,
              },
            })
          )
        );

        return property;
      }
    )
  );

  console.log(`Seeded ${properties.length} properties with property uses`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());