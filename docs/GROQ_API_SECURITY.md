# Groq API Key Security & Rotation

## Overview

MergeShip uses the Groq API for AI-powered triage and analysis. This document outlines security best practices for managing the `GROQ_API_KEY` environment variable.

## Setup

### 1. Generate a Scoped API Key

When creating your Groq API key:

1. Go to [Groq Console](https://console.groq.com)
2. Create a new API key
3. **Restrict the key to only these models** (if supported):
   - `llama3-8b-8192` (currently used by MergeShip)
   - Do NOT use a key with unrestricted access

### 2. Configure the Environment Variable

Set the `GROQ_API_KEY` environment variable in your deployment:

```bash
export GROQ_API_KEY="your_scoped_api_key_here"
```

**Never**:
- Commit the API key to version control
- Share the key in Slack, email, or unencrypted channels
- Use a single unrestricted key for multiple services

## Key Rotation Procedure

### When to Rotate

- **Monthly**: As part of regular security hygiene
- **Immediately**: If the key is suspected to be compromised
- **After deployment**: If the key was accidentally logged or exposed

### How to Rotate

1. **Create a new scoped API key** in the Groq console
2. **Update deployment environment variables**:
   - Update `GROQ_API_KEY` in your hosting platform (Vercel, Railway, etc.)
   - Redeploy the application
3. **Invalidate the old key** in the Groq console
4. **Document the rotation** in your incident log

### Detecting a Leak

Signs of a leaked key:
- Unusual API usage patterns in Groq dashboard (spike in requests from unknown IPs)
- Unexpected charges or rate limiting errors
- Groq alerts about suspicious activity

### Response to a Leak

1. **Immediately rotate the key** (follow steps above)
2. **Review Groq usage logs** for unauthorized calls
3. **Check MergeShip logs** for error patterns
4. **Document the incident** for audit trail
5. **Notify the security team** if costs were incurred

## Code Access

All Groq API calls must use the centralized client:

```typescript
// ✅ CORRECT: Use the centralized client
import { getGroqClient } from '@/lib/groq-client';
const groq = getGroqClient();

// ❌ INCORRECT: Never access process.env.GROQ_API_KEY directly
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
```

This centralized approach:
- Limits the blast radius if the key is accessed by injected code
- Makes it easier to add monitoring/logging
- Ensures consistent error handling

## Monitoring

The centralized client logs warnings if the key is not configured:

```
⚠️  GROQ_API_KEY is not set. AI triage features will be unavailable.
```

Monitor application logs for:
- Repeated `GROQ_API_KEY is not configured` errors
- API rate limit errors (429 status)
- Timeouts or connection failures

## FAQ

**Q: Can I use the same key for development and production?**  
A: No. Create separate keys for dev/staging/prod with appropriate rate limits.

**Q: How do I test without a real API key?**  
A: Use the `__setLlmProvider()` function in tests to mock the Groq provider.

**Q: What if I forget to set the API key?**  
A: The application will log a warning and gracefully degrade. AI features will be unavailable, but core functionality continues.
