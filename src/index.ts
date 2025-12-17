import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtilsPlugin from '@pothos/plugin-prisma-utils';
import RelayPlugin from '@pothos/plugin-relay';
import { PrismaClient } from '../prisma/client';
import PrismaTypes from '../prisma/generated';
import { DateResolver } from 'graphql-scalars';

const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
// notice in the logs that the params are the same, even though the args are different
prisma.$on("query", (e) => {
  console.log("Query: " + e.query);
  console.log("Params: " + e.params);
});

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    Date: { Input: Date; Output: Date };
    ID: { Input: string; Output: string | number };
  };
}>({
  relayOptions: {
    cursorType: 'String',
    clientMutationId: 'omit',
  },
  prisma: {
    client: prisma,
  },
  plugins: [PrismaPlugin, RelayPlugin, PrismaUtilsPlugin],
});

builder.addScalarType('Date', DateResolver, {});

builder.queryType({
  fields: (t) => ({
    property: t.prismaField({
      type: 'Property',
      args: {
        id: t.arg.id({ required: true }),
      },
      nullable: true,
      resolve: (query, root, args) => {
        return prisma.property.findUnique({ ...query, where: { id: args.id } });
      },
    }),
  }),
});

builder.prismaObject('Property', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
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
    // This is the connection field that causes the issue when used with totalCount
    propertyUses: t.relatedConnection('propertyUses', {
      cursor: 'id',
      totalCount: true,
      defaultSize: 10,
    }),
  }),
});

builder.prismaObject('PropertyUse', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    unitCount: t.exposeInt('unitCount'),
  }),
});

const schema = builder.toSchema({});

const query = /* graphql */ `
  query {
    property(id: "16d33909-d713-5dd2-34c7-156bc55453c7") {
      name
      livingUnits # this resolver fetches data from propertyUses
      propertyUses {
        totalCount
        # 'unsupported cursor type' error workaround
        # pageInfo {
        #   __typename
        # }
      }
    }
  }
`;

const yoga = createYoga({
  schema,
  graphiql: {
    defaultQuery: query,
  },
});

const server = createServer(yoga);

const port = 4000;

server.listen(port, () => console.log(`Server is running on http://localhost:${port}/graphql`));
