CREATE TABLE "audit_events" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_id" varchar(21),
	"actor_type" varchar(20),
	"actor_name" varchar(255),
	"target_type" varchar(50),
	"target_id" varchar(21),
	"target_name" varchar(255),
	"app_id" varchar(21),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_events_app_idx" ON "audit_events" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");