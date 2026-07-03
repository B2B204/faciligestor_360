import { createEntity } from '@/lib/entity';
const _entity = createEntity('bank_transactions', { hasUpdatedBy: false });
export const BankTransaction = _entity;
