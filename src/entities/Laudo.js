import { createEntity } from '@/lib/entity';
const _entity = createEntity('laudos', { legacyTimestamps: true, hasUpdatedBy: false });
export const Laudo = _entity;
