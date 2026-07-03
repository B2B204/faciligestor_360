import { createEntity } from '@/lib/entity';
const _entity = createEntity('measurements', { legacyTimestamps: true, hasUpdatedBy: false });
export const Measurement = _entity;
