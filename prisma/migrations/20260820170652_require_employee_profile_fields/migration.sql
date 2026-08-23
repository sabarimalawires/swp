/*
  Warnings:

  - Made the column `name` on table `Employee` required. This step will fail if there are existing NULL values in that column.
  - Made the column `username` on table `Employee` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "username" SET NOT NULL;
