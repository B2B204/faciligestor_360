import { createEntity } from '@/lib/entity';
const _entity = createEntity('data_access_logs', { hasCreatedBy: false, hasUpdatedBy: false });
export const DataAccessLog = _entity;
