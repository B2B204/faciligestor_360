import { createEntity } from '@/lib/entity';
const _entity = createEntity('invoices', { hasUpdatedBy: false });
export const Invoice = _entity;
