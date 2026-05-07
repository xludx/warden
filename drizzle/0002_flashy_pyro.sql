ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'viewer';--> statement-breakpoint
DROP TYPE "public"."membership_role";