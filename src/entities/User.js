import { supabase } from '@/api/supabaseClient';

async function getCurrentUserProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Não autenticado');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError;
  }

  return profile
    ? { id: user.id, email: user.email, ...profile }
    : { id: user.id, email: user.email };
}

export const User = {
  me: getCurrentUserProfile,

  filter: async (conditions = {}) => {
    let query = supabase.from('profiles').select('*');
    Object.entries(conditions).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value);
      }
    });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  logout: async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  },

  loginWithRedirect: (callbackUrl) => {
    const redirect = callbackUrl ? `?redirect=${encodeURIComponent(callbackUrl)}` : '';
    window.location.href = `/login${redirect}`;
  },
};
