import { createEntity } from '@/lib/entity';
const _entity = createEntity('employee_tasks', { hasCreatedBy: false, hasUpdatedBy: false });
export const EmployeeTask = _entity;
