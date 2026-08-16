import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';

export type AuditPayload = {
  action: string;
  entity: string;
  entityId: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  description: string;
  meta?: Record<string, any>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    return this.prisma.auditLog.create({
      data: {
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        meta: {
          actorId: payload.actorId ?? null,
          actorName: payload.actorName ?? 'System',
          actorRole: payload.actorRole ?? 'SYSTEM',
          description: payload.description,
          ...(payload.meta ?? {}),
        },
      },
    });
  }
}
