import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { auditRun } from '@/inngest/functions/audit-run';
import { processPrEvent } from '@/inngest/functions/process-pr-event';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [auditRun, processPrEvent],
});
