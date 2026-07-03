import { createEntity } from '@/lib/entity';
const _entity = createEntity('audit_reports', { hasCreatedBy: false, hasUpdatedBy: false });
export const AuditReport = _entity;
