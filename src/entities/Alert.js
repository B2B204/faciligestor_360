import { createEntity } from '@/lib/entity';
const _entity = createEntity('alerts', { legacyTimestamps: true, hasUpdatedBy: false });
export const Alert = _entity;
