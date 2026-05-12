import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { auditRun } from '@/inngest/functions/audit-run';
import { processPrEvent } from '@/inngest/functions/process-pr-event';
import { helpDispatch } from '@/inngest/functions/help-dispatch';
import { processReviewEvent } from '@/inngest/functions/process-review-event';
import {
  processInstallationEvent,
  processInstallationReposEvent,
} from '@/inngest/functions/process-installation-event';
import { issuesSweep } from '@/inngest/functions/issues-sweep';
import { recommendationsBuild } from '@/inngest/functions/recommendations-build';
import { streakDetect, recsExpire, activityLogCleanup } from '@/inngest/functions/maintenance';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    auditRun,
    processPrEvent,
    helpDispatch,
    processReviewEvent,
    processInstallationEvent,
    processInstallationReposEvent,
    issuesSweep,
    recommendationsBuild,
    streakDetect,
    recsExpire,
    activityLogCleanup,
  ],
});
