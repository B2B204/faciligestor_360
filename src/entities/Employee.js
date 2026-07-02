import { createEntity } from '@/lib/entity';
const _entity = createEntity('employees', { legacyTimestamps: true });
export const Employee = _entity;
