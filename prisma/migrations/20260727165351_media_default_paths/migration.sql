-- AlterTable
ALTER TABLE "users" ALTER COLUMN "avatar_url" SET DEFAULT '/avatars/default.svg',
ALTER COLUMN "banner_url" SET DEFAULT '/banners/default.svg';

UPDATE "users" SET "avatar_url" = '/avatars/default.svg' WHERE "avatar_url" = 'assets/avatars/default.png';
UPDATE "users" SET "banner_url" = '/banners/default.svg' WHERE "banner_url" = 'assets/banners/default.png';
