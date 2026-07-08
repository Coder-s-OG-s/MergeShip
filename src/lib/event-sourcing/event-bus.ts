import type { StoredEvent } from './event-store';

type EventHandler = (event: StoredEvent) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export function onEvent(eventType: string, handler: EventHandler): void {
  const existing = handlers.get(eventType) ?? [];
  existing.push(handler);
  handlers.set(eventType, existing);
}

export async function publish(event: StoredEvent): Promise<void> {
  const eventHandlers = handlers.get(event.eventType) ?? [];
  await Promise.allSettled(eventHandlers.map((h) => h(event)));
}

export function clearHandlers(): void {
  handlers.clear();
}

export async function publishToReadModels(event: StoredEvent): Promise<void> {
  await publish(event);
}
