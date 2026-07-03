import { supabase } from '@/api/supabaseClient';

function parseSortField(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith('-');
  const field = desc ? sortStr.slice(1) : sortStr;
  // Sem remapeamento: algumas tabelas (legadas, migradas do base44) usam
  // literalmente "created_date"/"updated_date" como nome de coluna; outras
  // (criadas depois, direto no Supabase) usam "created_at"/"updated_at".
  // Cada chamador já passa o nome de coluna real da sua tabela.
  return { column: field, ascending: !desc };
}

/**
 * @param {string} tableName
 * @param {{ legacyTimestamps?: boolean, hasCreatedBy?: boolean, hasUpdatedBy?: boolean }} [options]
 *   - legacyTimestamps: true para tabelas migradas do base44 que usam as
 *     colunas "created_date"/"updated_date" em vez de "created_at"/"updated_at".
 *   - hasCreatedBy: false para tabelas que nao tem a coluna "created_by".
 *   - hasUpdatedBy: false para tabelas que nao tem a coluna "updated_by"
 *     (algumas tabelas legadas so tem "created_by").
 */
export function createEntity(tableName, options = {}) {
  const createdColumn = options.legacyTimestamps ? 'created_date' : 'created_at';
  const updatedColumn = options.legacyTimestamps ? 'updated_date' : 'updated_at';
  const hasCreatedBy = options.hasCreatedBy !== false;
  const hasUpdatedBy = options.hasUpdatedBy !== false;

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
        query = query.order(createdColumn, { ascending: false });
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
      if (user?.email && hasCreatedBy) row.created_by = user.email;

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
      const row = { ...payload, [updatedColumn]: new Date().toISOString() };
      if (user?.email && hasUpdatedBy) row.updated_by = user.email;

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
        ...(user?.email && hasCreatedBy ? { created_by: user.email } : {}),
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
