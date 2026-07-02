import { supabase } from '@/api/supabaseClient';

function parseSortField(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith('-');
  const field = desc ? sortStr.slice(1) : sortStr;
  const colMap = {
    created_date: 'created_at',
    updated_date: 'updated_at',
    created_at: 'created_at',
    updated_at: 'updated_at',
  };
  return { column: colMap[field] || field, ascending: !desc };
}

export function createEntity(tableName) {
  return {
    async filter(conditions = {}, sort = null, limit = 1000) {
      let query = supabase.from(tableName).select('*');

      Object.entries(conditions).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });

      const sortParsed = parseSortField(sort);
      if (sortParsed) {
        query = query.order(sortParsed.column, { ascending: sortParsed.ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.limit(limit);

      const { data, error } = await query;
      if (error) {
        console.error(`[entity:${tableName}] filter error:`, error);
        throw error;
      }
      return data || [];
    },

    async list(sort = null, limit = 1000) {
      return this.filter({}, sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const { data: { user } } = await supabase.auth.getUser();
      const row = { ...payload };
      if (user?.email) row.created_by = user.email;

      const { data, error } = await supabase
        .from(tableName)
        .insert([row])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data: { user } } = await supabase.auth.getUser();
      const row = { ...payload, updated_at: new Date().toISOString() };
      if (user?.email) row.updated_by = user.email;

      const { data, error } = await supabase
        .from(tableName)
        .update(row)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    async bulkCreate(items) {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = items.map(item => ({
        ...item,
        ...(user?.email ? { created_by: user.email } : {}),
      }));
      const { data, error } = await supabase
        .from(tableName)
        .insert(rows)
        .select();
      if (error) throw error;
      return data || [];
    },
  };
}
