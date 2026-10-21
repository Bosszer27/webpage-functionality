CREATE TABLE "vault_members" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_presence" (
	"id" text PRIMARY KEY,
	"member_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_presence" ADD CONSTRAINT "vault_presence_member_id_vault_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "vault_members"("id") ON DELETE CASCADE;