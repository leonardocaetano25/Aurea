import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL?.trim();const key=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
export const configured=Boolean(url&&key&&!url.includes('SEU-PROJETO')&&!key.includes('COLE_A'));
export const supabase=configured?createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export function client(){if(!supabase)throw Error('Configure o Supabase antes de continuar.');return supabase;}