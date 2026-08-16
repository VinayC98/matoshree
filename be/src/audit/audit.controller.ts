import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma.service.js';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const where: {
      action?: string;
      entity?: string;
    } = {};

    if (action?.trim()) {
      where.action = action.trim();
    }

    if (entity?.trim()) {
      where.entity = entity.trim();
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = rows.map((log) => {
      const meta =
        log.meta && typeof log.meta === 'object' && !Array.isArray(log.meta)
          ? (log.meta as Record<string, any>)
          : {};

      const originalAction =
        typeof meta.originalAction === 'string'
          ? meta.originalAction
          : undefined;

      const isRollback = log.action === 'AUDIT_ROLLBACK';

      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        createdAt: log.createdAt,

        actorId: typeof meta.actorId === 'string' ? meta.actorId : null,
        actorName:
          typeof meta.actorName === 'string' ? meta.actorName : 'System',
        actorRole:
          typeof meta.actorRole === 'string' ? meta.actorRole : 'SYSTEM',

        description:
          typeof meta.description === 'string'
            ? meta.description
            : this.buildFallbackDescription(log.action, log.entity),

        meta,
        isRollback,
        rolledBackFrom:
          typeof meta.rolledBackFrom === 'string' ? meta.rolledBackFrom : null,
        originalAction: originalAction ?? null,
      };
    });

    return {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      data,
    };
  }

  /**
   * This endpoint records a rollback event.
   *
   * It does NOT reverse the original database transaction.
   * Keep this separate from a real domain-specific undo operation.
   */
  @Post(':id/rollback')
  async rollback(@Param('id') id: string) {
    const auditEntry = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!auditEntry) {
      throw new NotFoundException('Audit entry not found');
    }

    const meta =
      auditEntry.meta &&
      typeof auditEntry.meta === 'object' &&
      !Array.isArray(auditEntry.meta)
        ? (auditEntry.meta as Record<string, any>)
        : {};

    await this.prisma.auditLog.create({
      data: {
        action: 'AUDIT_ROLLBACK',
        entity: auditEntry.entity,
        entityId: auditEntry.entityId,
        meta: {
          actorId: null,
          actorName: 'System',
          actorRole: 'SYSTEM',
          description: `Rollback recorded for ${auditEntry.action} on ${auditEntry.entity}.`,
          rolledBackFrom: auditEntry.id,
          originalAction: auditEntry.action,
          originalMeta: meta,
        },
      },
    });

    return {
      message: 'Audit rollback recorded',
    };
  }

  private buildFallbackDescription(action: string, entity: string) {
    return `${this.humanize(action)} on ${this.humanize(entity)}.`;
  }

  private humanize(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
