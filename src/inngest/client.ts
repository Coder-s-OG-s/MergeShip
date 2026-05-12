import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'mergeship',
  // Inngest reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from env at runtime.
});
