DO $$ BEGIN
 CREATE TYPE "channel_type" AS ENUM('email', 'sms', 'push', 'in_app');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "priority_level" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"marketing_enabled" boolean DEFAULT false NOT NULL,
	"digest_frequency" varchar(20) DEFAULT 'never',
	"novu_subscriber_id" varchar(100),
	"preferences" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer NOT NULL,
	"recipient_email" varchar(255),
	"recipient_phone" varchar(20),
	"recipient_device_token" varchar(255),
	"template_id" integer,
	"channel" "channel_type" NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"data" json,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"priority" "priority_level" DEFAULT 'medium' NOT NULL,
	"external_id" varchar(255),
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"channel" "channel_type" NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"variables" json,
	"is_active" boolean DEFAULT true,
	"novu_template_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
