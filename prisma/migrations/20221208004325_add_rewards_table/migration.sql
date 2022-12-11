-- CreateTable
CREATE TABLE "rewards" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "indications" INTEGER NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);
