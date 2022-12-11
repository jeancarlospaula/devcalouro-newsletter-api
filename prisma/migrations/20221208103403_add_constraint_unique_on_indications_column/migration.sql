/*
  Warnings:

  - A unique constraint covering the columns `[indications]` on the table `rewards` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "rewards" ALTER COLUMN "url" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "rewards_indications_key" ON "rewards"("indications");
