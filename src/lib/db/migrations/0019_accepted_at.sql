ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
-- C1: data di accettazione dei preventivi già accettati. Dalla firma del
-- cliente quando c'è, altrimenti dall'ultima modifica (la migliore stima).
UPDATE "quotes" q SET "accepted_at" = COALESCE(
  (SELECT max(s."signed_at") FROM "quote_signatures" s WHERE s."quote_id" = q."id" AND s."action" = 'accepted'),
  q."updated_at"
) WHERE q."status" = 'accepted' AND q."accepted_at" IS NULL;
