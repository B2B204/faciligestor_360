import { createEntity } from '@/lib/entity';
const _entity = createEntity('user_invites', { legacyTimestamps: true });
export const UserInvite = _entity;
