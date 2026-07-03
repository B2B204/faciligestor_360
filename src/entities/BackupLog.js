import { createEntity } from '@/lib/entity';
const _entity = createEntity('backup_logs', { legacyTimestamps: true, hasUpdatedBy: false });
export const BackupLog = _entity;
