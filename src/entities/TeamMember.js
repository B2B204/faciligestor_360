import { createEntity } from '@/lib/entity';
const _entity = createEntity('team_members', { legacyTimestamps: true, hasUpdatedBy: false });
export const TeamMember = _entity;
