import { createEntity } from '@/lib/entity';
const _entity = createEntity('task_comments', { hasCreatedBy: false, hasUpdatedBy: false });
export const TaskComment = _entity;
