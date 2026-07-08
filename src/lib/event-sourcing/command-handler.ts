import type { Result } from '../result';
import { ok, err } from '../result';
import { checkIdempotency, storeIdempotency } from './idempotency';
import { appendEvent, type DomainEvent, type StoredEvent } from './event-store';
import { publishToReadModels } from './event-bus';

export type CommandDTO = {
  idempotencyKey?: string;
  [key: string]: unknown;
};

export type CommandValidation = {
  isValid: boolean;
  errors?: string[];
};

export abstract class CommandHandler<T extends CommandDTO> {
  abstract commandName: string;

  async execute(dto: T): Promise<Result<StoredEvent>> {
    if (dto.idempotencyKey) {
      const existing = await checkIdempotency(dto.idempotencyKey);
      if (existing) {
        return ok(existing as unknown as StoredEvent);
      }
    }

    const validation = await this.validate(dto);
    if (!validation.isValid) {
      return err('VALIDATION_ERROR', validation.errors?.join('; ') ?? 'Validation failed');
    }

    const event = await this.createEvent(dto);
    const stored = await appendEvent(event);

    await this.onEventStored(dto);

    await publishToReadModels(stored);

    if (dto.idempotencyKey) {
      await storeIdempotency(dto.idempotencyKey, stored as never);
    }

    return ok(stored);
  }

  protected abstract validate(dto: T): Promise<CommandValidation>;
  protected abstract createEvent(dto: T): Promise<DomainEvent>;

  protected async onEventStored(_dto: T): Promise<void> {
    // Override in subclasses for side effects (e.g. insertXpEvent).
  }
}
