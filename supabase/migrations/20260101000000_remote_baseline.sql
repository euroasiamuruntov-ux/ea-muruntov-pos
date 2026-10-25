-- ============================================================================
-- Jonli bazaning (Supabase, 2026-10-25) HAQIQIY sxemasi: `supabase db dump --linked --schema public`.
-- Jonli bazada bu allaqachon mavjud, shuning uchun uni "qo'llangan" deb belgilash kerak:
--   npx supabase migration repair --status applied 20260101000000
-- Lokal bazada (`npm run db:reset`) bu fayl avval ishga tushadi, keyin keyingi migratsiyalar.
-- Faylni tahrirlamang; sxema o'zgarishlari yangi migratsiya fayllari orqali qilinadi.
--
-- Eslatma: dumpdagi `set_config('search_path', '')` qatori olib tashlangan (keyingi migratsiyalarga
-- ta'sir qilmasligi uchun); barcha obyektlar `public.` bilan to'liq yozilgan.
-- ============================================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "order_num" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "debtor_id" "uuid",
    "order_id" "uuid",
    "amount" integer NOT NULL,
    "pay_type" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debt_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debtors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "total_debt" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debtors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "qty" integer NOT NULL,
    "price" integer NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "worker_id" "uuid",
    "total" integer NOT NULL,
    "pay_type" "text",
    "debtor_name" "text",
    "debt_paid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "debtor_id" "uuid",
    "actual_paid" integer,
    "payment_note" "text",
    CONSTRAINT "orders_pay_type_check" CHECK (("pay_type" = ANY (ARRAY['naqd'::"text", 'click'::"text", 'karta'::"text", 'qarz'::"text", 'ichki'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."osh_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "product_group" "text" NOT NULL,
    "total_hissa" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."osh_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" integer NOT NULL,
    "category_id" "uuid",
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unit_type" "text" DEFAULT 'dona'::"text",
    "hissa_per_unit" integer DEFAULT 1,
    "kg_to_hissa" integer DEFAULT 21,
    "is_unlimited" boolean DEFAULT false,
    "unit_label" "text" DEFAULT 'dona'::"text",
    "litr_per_unit" numeric,
    "hide_when_empty" boolean DEFAULT false
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "product_id" "uuid",
    "system_qty" numeric DEFAULT 0,
    "actual_qty" numeric DEFAULT 0,
    "diff" numeric DEFAULT 0,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shift_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "product_id" "uuid",
    "initial_qty" integer DEFAULT 0,
    "actual_qty" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "total_hissa" integer DEFAULT 0
);


ALTER TABLE "public"."shift_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opened_by" "uuid",
    "opened_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    "is_open" boolean DEFAULT true,
    "closed_by" "uuid"
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "pin" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'worker'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."shift_summary" AS
 SELECT "s"."id",
    "s"."opened_at",
    "s"."closed_at",
    "s"."is_open",
    "opener"."name" AS "opened_by_name",
    "closer"."name" AS "closed_by_name",
    "count"(DISTINCT "o"."id") AS "order_count",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" <> 'ichki'::"text") THEN COALESCE("o"."actual_paid", "o"."total")
            ELSE 0
        END), (0)::bigint) AS "total_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" = 'naqd'::"text") THEN COALESCE("o"."actual_paid", "o"."total")
            ELSE 0
        END), (0)::bigint) AS "cash_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" = 'click'::"text") THEN COALESCE("o"."actual_paid", "o"."total")
            ELSE 0
        END), (0)::bigint) AS "click_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" = 'karta'::"text") THEN COALESCE("o"."actual_paid", "o"."total")
            ELSE 0
        END), (0)::bigint) AS "card_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" = 'qarz'::"text") THEN "o"."total"
            ELSE 0
        END), (0)::bigint) AS "debt_revenue",
    COALESCE("sum"(
        CASE
            WHEN ("o"."pay_type" = 'ichki'::"text") THEN 1
            ELSE 0
        END), (0)::bigint) AS "ichki_count"
   FROM ((("public"."shifts" "s"
     LEFT JOIN "public"."users" "opener" ON (("s"."opened_by" = "opener"."id")))
     LEFT JOIN "public"."users" "closer" ON (("s"."closed_by" = "closer"."id")))
     LEFT JOIN "public"."orders" "o" ON (("o"."shift_id" = "s"."id")))
  GROUP BY "s"."id", "s"."opened_at", "s"."closed_at", "s"."is_open", "opener"."name", "closer"."name"
  ORDER BY "s"."opened_at" DESC;


ALTER VIEW "public"."shift_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "product_id" "uuid",
    "qty" integer NOT NULL,
    "worker_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."write_offs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "product_id" "uuid",
    "qty" integer NOT NULL,
    "reason" "text" NOT NULL,
    "worker_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."write_offs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debtors"
    ADD CONSTRAINT "debtors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."osh_stock"
    ADD CONSTRAINT "osh_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_reports"
    ADD CONSTRAINT "shift_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_stock"
    ADD CONSTRAINT "shift_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_ins"
    ADD CONSTRAINT "stock_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pin_key" UNIQUE ("pin");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id");



ALTER TABLE ONLY "public"."debt_payments"
    ADD CONSTRAINT "debt_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_debtor_id_fkey" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."osh_stock"
    ADD CONSTRAINT "osh_stock_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_reports"
    ADD CONSTRAINT "shift_reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."shift_reports"
    ADD CONSTRAINT "shift_reports_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."shift_stock"
    ADD CONSTRAINT "shift_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_stock"
    ADD CONSTRAINT "shift_stock_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_ins"
    ADD CONSTRAINT "stock_ins_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_ins"
    ADD CONSTRAINT "stock_ins_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."stock_ins"
    ADD CONSTRAINT "stock_ins_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."write_offs"
    ADD CONSTRAINT "write_offs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id");



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."debt_payments" TO "anon";
GRANT ALL ON TABLE "public"."debt_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_payments" TO "service_role";



GRANT ALL ON TABLE "public"."debtors" TO "anon";
GRANT ALL ON TABLE "public"."debtors" TO "authenticated";
GRANT ALL ON TABLE "public"."debtors" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."osh_stock" TO "anon";
GRANT ALL ON TABLE "public"."osh_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."osh_stock" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."shift_reports" TO "anon";
GRANT ALL ON TABLE "public"."shift_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_reports" TO "service_role";



GRANT ALL ON TABLE "public"."shift_stock" TO "anon";
GRANT ALL ON TABLE "public"."shift_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_stock" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."shift_summary" TO "anon";
GRANT ALL ON TABLE "public"."shift_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_summary" TO "service_role";



GRANT ALL ON TABLE "public"."stock_ins" TO "anon";
GRANT ALL ON TABLE "public"."stock_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_ins" TO "service_role";



GRANT ALL ON TABLE "public"."write_offs" TO "anon";
GRANT ALL ON TABLE "public"."write_offs" TO "authenticated";
GRANT ALL ON TABLE "public"."write_offs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







