import { execute, parse } from "graphql";
import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import PrismaUtilsPlugin from "@pothos/plugin-prisma-utils";
import RelayPlugin from "@pothos/plugin-relay";
import { PrismaClient } from "@prisma/client";
import PrismaTypes from "../prisma/generated";
import { DateResolver } from "graphql-scalars";

// Enable Prisma query logging to see the duplicate queries
const prisma = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

// Log the queries to show the issue with same params
prisma.$on("query", (e) => {
  console.log("Query: " + e.query);
  console.log("Params: " + e.params);
  console.log("-".repeat(50));
});

// Build schema exactly like in index.ts
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    Date: { Input: Date; Output: Date };
    ID: { Input: string; Output: string | number };
  };
}>({
  relayOptions: {
    cursorType: "String",
    clientMutationId: "omit",
  },
  prisma: {
    client: prisma,
  },
  plugins: [PrismaPlugin, RelayPlugin, PrismaUtilsPlugin],
});

builder.addScalarType("Date", DateResolver, {});

builder.queryType({
  fields: (t) => ({
    property: t.prismaField({
      type: "Property",
      args: {
        id: t.arg.id({ required: true }),
      },
      nullable: true,
      resolve: (query, root, args) => {
        return prisma.property.findUnique({
          ...query,
          where: { id: args.id as string },
        });
      },
    }),
    properties: t.prismaConnection({
      type: "Property",
      cursor: "id",
      resolve: (query) => prisma.property.findMany({ ...query }),
    }),
  }),
});

builder.prismaObject("Property", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    // This resolver accesses propertyUses data
    livingUnits: t.int({
      nullable: true,
      select: {
        propertyUses: {
          select: {
            unitCount: true,
          },
        },
      },
      resolve: (property) => {
        // Sum up the unit counts from property uses
        return property.propertyUses.reduce(
          (sum, use) => sum + use.unitCount,
          0
        );
      },
    }),
    // This is the connection field that causes the issue when used with totalCount
    propertyUses: t.relatedConnection("propertyUses", {
      cursor: "id",
      totalCount: true,
      defaultSize: 10,
    }),
  }),
});

builder.prismaObject("PropertyUse", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    unitCount: t.exposeInt("unitCount"),
  }),
});

const schema = builder.toSchema({});

async function run() {
  // Get a property ID for testing
  const firstProperty = await prisma.property.findFirst({
    orderBy: { name: "asc" },
  });

  if (!firstProperty) {
    console.error("No properties found. Run 'npm run seed' first.");
    return;
  }

  let bugDetected = false;
  const cursorErrors: string[] = [];

  console.log("=".repeat(70));
  console.log("TEST 1: Query with ONLY totalCount (Shows the cursor bug)");
  console.log("=".repeat(70));
  console.log("This query triggers the 'Unsupported cursor type' error");
  console.log("because it has totalCount but NO edges and NO pageInfo.");
  console.log();

  // Query that demonstrates the issue - totalCount ONLY
  const BUGGY_QUERY = `
    query PropertyTotalCountOnly($id: ID!) {
      property(id: $id) {
        name
        livingUnits  # Field that selects from propertyUses
        propertyUses {
          totalCount  # Only totalCount, no edges, no pageInfo = BUG!
        }
      }
    }
  `;

  const result1 = await execute({
    schema,
    document: parse(BUGGY_QUERY),
    contextValue: {},
    variableValues: { id: firstProperty.id },
  });

  if (result1.errors) {
    console.error("❌ Error found (EXPECTED):", result1.errors);
    const cursorError = result1.errors.find((err) =>
      err.message.includes("Unsupported cursor type")
    );
    if (cursorError) {
      bugDetected = true;
      cursorErrors.push(`Test 1: ${cursorError.message}`);
      console.log("\n🔴 Bug confirmed: Unsupported cursor type error");
    }
  } else {
    console.log("✅ Query executed successfully (unexpected)");
    console.log("Result:", JSON.stringify(result1.data, null, 2));
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST 2: Query WITH edges (Workaround #1)");
  console.log("=".repeat(70));
  console.log("Adding 'edges' prevents the cursor type error.");
  console.log();

  const EDGES_WORKAROUND = `
    query PropertyWithEdges($id: ID!) {
      property(id: $id) {
        name
        livingUnits  # Field that selects from propertyUses
        propertyUses {
          totalCount
          edges {  # Adding edges prevents the error!
            node {
              id
              name
              unitCount
            }
          }
          # No pageInfo needed when edges are present
        }
      }
    }
  `;

  const result2 = await execute({
    schema,
    document: parse(EDGES_WORKAROUND),
    contextValue: {},
    variableValues: { id: firstProperty.id },
  });

  if (result2.errors) {
    console.error("❌ Errors found (unexpected):", result2.errors);
    const cursorError = result2.errors.find((err) =>
      err.message.includes("Unsupported cursor type")
    );
    if (cursorError) {
      cursorErrors.push(`Test 2: ${cursorError.message}`);
    }
  } else {
    console.log("✅ Query executed successfully (EXPECTED - edges workaround)");
    console.log("Result:", JSON.stringify(result2.data, null, 2));
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST 3: Query WITH pageInfo (Workaround #2)");
  console.log("=".repeat(70));
  console.log("Adding 'pageInfo' also prevents the cursor type error.");
  console.log();

  const PAGEINFO_WORKAROUND = `
    query PropertyWithPageInfo($id: ID!) {
      property(id: $id) {
        name
        livingUnits  # Field that selects from propertyUses
        propertyUses {
          totalCount
          pageInfo {  # Adding pageInfo prevents the error!
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          # No edges needed when pageInfo is present
        }
      }
    }
  `;

  const result3 = await execute({
    schema,
    document: parse(PAGEINFO_WORKAROUND),
    contextValue: {},
    variableValues: { id: firstProperty.id },
  });

  if (result3.errors) {
    console.error("❌ Errors found:", result3.errors);
    const cursorError = result3.errors.find((err) =>
      err.message.includes("Unsupported cursor type")
    );
    if (cursorError) {
      bugDetected = true;
      cursorErrors.push(`Test 3: ${cursorError.message}`);
    }
  } else {
    console.log("✅ Query executed successfully (EXPECTED - pageInfo workaround)");
    console.log("Result:", JSON.stringify(result3.data, null, 2));
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY:");
  console.log("=".repeat(70));

  if (bugDetected) {
    console.log("\n🔴 BUG CONFIRMED: Unsupported cursor type error detected!");
    cursorErrors.forEach((err) => console.log(`   - ${err}`));
    console.log("\nThe Pothos Prisma cursor pagination issue occurs when:");
    console.log("  1. A field (livingUnits) selects from a relation (propertyUses)");
    console.log("  2. The same relation is used in a connection with ONLY totalCount");
    console.log("  3. NO 'edges' and NO 'pageInfo' are included");
    console.log("\nWORKAROUNDS (either one works):");
    console.log("  - Include 'edges' in the query");
    console.log("  - Include 'pageInfo' in the query");
  } else {
    console.log("\n⚠️  No cursor type error detected in this run.");
    console.log("This might mean:");
    console.log("  - The bug has been fixed");
    console.log("  - The specific conditions aren't met");
    console.log("  - Try different query combinations");
  }

  console.log("\nCheck the Prisma query logs above for:");
  console.log("  - Duplicate or unnecessary queries");
  console.log("  - Same params being used for different queries");
  console.log("  - Inefficient data loading patterns");
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

run().catch(console.error);
