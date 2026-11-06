import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ihmwofghodonuvzzirmj.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_i_ECyqCSuRhmYAIjy-qx6A_FChE1E5j';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
