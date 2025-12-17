import { builder } from "../builder";
import { prisma } from "../db";

// PropertyUse type
export const PropertyUse = builder.prismaObject("PropertyUse", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    unitCount: t.exposeInt("unitCount"),
  }),
});

// Property type demonstrating cursor pagination issue
export const Property = builder.prismaNode("Property", {
  id: { field: "id" },
  fields: (t) => ({
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
        return property.propertyUses.reduce((sum, use) => sum + use.unitCount, 0);
      },
    }),

    // relatedConnection that causes the cursor issue
    propertyUses: t.relatedConnection("propertyUses", {
      cursor: "id",
      totalCount: true,
      nullable: false,
      query: () => ({
        orderBy: { name: "asc" as const },
      }),
    }),
  }),
});

// Query to fetch properties
builder.queryField("properties", (t) =>
  t.prismaConnection({
    type: "Property",
    cursor: "id",
    resolve: (query) =>
      prisma.property.findMany({
        ...query,
        orderBy: { name: "asc" },
      }),
  })
);

// Query to fetch a single property
builder.queryField("property", (t) =>
  t.prismaField({
    type: "Property",
    args: {
      id: t.arg.id({ required: true }),
    },
    nullable: true,
    resolve: (query, root, args) =>
      prisma.property.findUnique({
        ...query,
        where: { id: String(args.id) },
      }),
  })
);