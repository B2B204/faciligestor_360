import { createEntity } from '@/lib/entity';
const _entity = createEntity('task_checklist_items', { hasCreatedBy: false, hasUpdatedBy: false });
export const TaskChecklistItem = _entity;
