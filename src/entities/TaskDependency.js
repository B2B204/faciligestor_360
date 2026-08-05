import { createEntity } from '@/lib/entity';
const _entity = createEntity('task_dependencies', { hasCreatedBy: false, hasUpdatedBy: false });
export const TaskDependency = _entity;
