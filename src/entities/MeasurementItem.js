import { createEntity } from '@/lib/entity';
const _entity = createEntity('measurement_items', { legacyTimestamps: true, hasUpdatedBy: false });
export const MeasurementItem = _entity;
