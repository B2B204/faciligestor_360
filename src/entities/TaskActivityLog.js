import { createEntity } from '@/lib/entity';
const _entity = createEntity('task_activity_log', { hasCreatedBy: false, hasUpdatedBy: false });
export const TaskActivityLog = _entity;
