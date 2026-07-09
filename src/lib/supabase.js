import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Создайте файл .env по образцу .env.example."
  );
}

export const supabase = createClient(url, anonKey);
export const BUCKET = "product-images";
