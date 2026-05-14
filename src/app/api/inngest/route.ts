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
import { maintainerDiscover } from '@/inngest/functions/maintainer-discover';
import {
  processMembershipEvent,
  processMemberEvent,
} from '@/inngest/functions/process-membership-events';
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
    maintainerDiscover,
    processMembershipEvent,
    processMemberEvent,
    streakDetect,
    recsExpire,
    activityLogCleanup,
  ],
});
