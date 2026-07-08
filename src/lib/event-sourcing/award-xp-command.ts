import { CommandHandler, type CommandDTO, type CommandValidation } from './command-handler';
import type { DomainEvent } from './event-store';
import { insertXpEvent, type XpEventInsert } from '@/lib/xp/events';

export type AwardXPCommandDTO = CommandDTO &
  XpEventInsert & {
    idempotencyKey?: string;
  };

export class AwardXPCommand extends CommandHandler<AwardXPCommandDTO> {
  commandName = 'award_xp';

  protected async validate(dto: AwardXPCommandDTO): Promise<CommandValidation> {
    const errors: string[] = [];
    if (!dto.userId) errors.push('userId is required');
    if (!dto.source) errors.push('source is required');
    if (!dto.refId) errors.push('refId is required');
    if (typeof dto.xpDelta !== 'number' || dto.xpDelta <= 0) {
      errors.push('xpDelta must be a positive number');
    }
    return { isValid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async createEvent(dto: AwardXPCommandDTO): Promise<DomainEvent> {
    return {
      aggregateType: 'xp',
      aggregateId: dto.userId,
      eventType: 'xp_awarded',
      payload: {
        userId: dto.userId,
        source: dto.source,
        refType: dto.refType,
        refId: dto.refId,
        repo: dto.repo,
        difficulty: dto.difficulty,
        xpDelta: dto.xpDelta,
        metadata: dto.metadata,
        dailyCapAction: dto.dailyCapLimit?.action,
        dailyCapLimit: dto.dailyCapLimit?.limit,
      },
      idempotencyKey: dto.idempotencyKey,
    };
  }

  protected override async onEventStored(dto: AwardXPCommandDTO): Promise<void> {
    await insertXpEvent(dto);
  }
}
