import { createEntity } from '@/lib/entity';
const _entity = createEntity('leads', { hasUpdatedBy: false });
export const Lead = _entity;
