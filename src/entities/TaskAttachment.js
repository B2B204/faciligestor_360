import { createEntity } from '@/lib/entity';
const _entity = createEntity('task_attachments', { hasCreatedBy: false, hasUpdatedBy: false });
export const TaskAttachment = _entity;
