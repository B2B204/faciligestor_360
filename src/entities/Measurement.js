import { createEntity } from '@/lib/entity';
const _entity = createEntity('measurements', { legacyTimestamps: true });
export const Measurement = _entity;
