import { createEntity } from '@/lib/entity';
const _entity = createEntity('invoice_items', { hasCreatedBy: false, hasUpdatedBy: false });
export const InvoiceItem = _entity;
