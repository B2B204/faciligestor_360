import { createEntity } from '@/lib/entity';
const _entity = createEntity('posts', { legacyTimestamps: true });
export const Post = _entity;
