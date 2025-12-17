-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyUse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "PropertyUse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PropertyUse" ADD CONSTRAINT "PropertyUse_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
