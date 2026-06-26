/**
 * Supabase database types — auto-generated, do not edit by hand.
 *
 * To regenerate after a schema change:
 *
 *   npm run types:gen
 *
 * This requires:
 *   1. Supabase CLI installed: npm install -g supabase
 *   2. SUPABASE_PROJECT_ID set in your environment (find it in
 *      your Supabase project settings under "General")
 *   3. You are logged in: supabase login
 *
 * For local dev against a local Supabase instance:
 *
 *   npm run types:gen:local
 *
 * Once generated, replace `any` casts on Supabase clients with the
 * typed helper:
 *
 *   import type { Database } from "@/lib/database.types";
 *   import { createClient } from "@supabase/supabase-js";
 *
 *   const supabase = createClient<Database>(url, key);
 *
 * This file is committed so the repo always has a valid type export,
 * even before the first generation run.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Run `npm run types:gen` to populate this file with your real schema.
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
