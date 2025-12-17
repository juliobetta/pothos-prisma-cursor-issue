/* eslint-disable */
import type { Prisma, Property, PropertyUse } from "./client/index.js";
export default interface PrismaTypes {
    Property: {
        Name: "Property";
        Shape: Property;
        Include: Prisma.PropertyInclude;
        Select: Prisma.PropertySelect;
        OrderBy: Prisma.PropertyOrderByWithRelationInput;
        WhereUnique: Prisma.PropertyWhereUniqueInput;
        Where: Prisma.PropertyWhereInput;
        Create: Prisma.PropertyCreateInput;
        Update: Prisma.PropertyUpdateInput;
        RelationName: "propertyUses";
        ListRelations: "propertyUses";
        Relations: {
            propertyUses: {
                Shape: PropertyUse[];
                Name: "PropertyUse";
                Nullable: false;
            };
        };
    };
    PropertyUse: {
        Name: "PropertyUse";
        Shape: PropertyUse;
        Include: Prisma.PropertyUseInclude;
        Select: Prisma.PropertyUseSelect;
        OrderBy: Prisma.PropertyUseOrderByWithRelationInput;
        WhereUnique: Prisma.PropertyUseWhereUniqueInput;
        Where: Prisma.PropertyUseWhereInput;
        Create: Prisma.PropertyUseCreateInput;
        Update: Prisma.PropertyUseUpdateInput;
        RelationName: "property";
        ListRelations: never;
        Relations: {
            property: {
                Shape: Property;
                Name: "Property";
                Nullable: false;
            };
        };
    };
}