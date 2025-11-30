# TechCrunch Scraper Cron Job Setup

This guide explains how to set up the TechCrunch scraper to run automatically every hour during TechCrunch's active publishing hours (6 AM - 10 PM Pacific Time).

## Overview

The scraper is now available as:
1. **Next.js API Route**: `/api/scrape-techcrunch` (POST/GET)
2. **Scheduled Cron Job**: Runs hourly via Supabase pg_cron or external services

## Architecture

```
┌─────────────────┐
│  Cron Scheduler │ (Supabase pg_cron or external)
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  Next.js API    │ /api/scrape-techcrunch
│  Route          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Scraper        │ scrape_techcrunch_supabase_pinecone.ts
│  Function       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Supabase       │     │  Pinecone    │
│  Database       │     │  Embeddings  │
└─────────────────┘     └──────────────┘
```

## Setup Options

### Option 1: Supabase pg_cron (Recommended for Supabase Projects)

#### Prerequisites
- Supabase project with pg_cron extension enabled
- Deployed Next.js application with the API route accessible

#### Steps

1. **Deploy your Next.js app** (Vercel, Railway, etc.)
   - Make sure the `/api/scrape-techcrunch` route is accessible
   - Note the full URL (e.g., `https://your-app.vercel.app/api/scrape-techcrunch`)

2. **Set environment variables in Supabase**
   ```sql
   -- Set the API URL
   ALTER DATABASE postgres SET app.techcrunch_api_url = 'https://your-app.vercel.app/api/scrape-techcrunch';
   
   -- Set the cron secret (optional, for security)
   ALTER DATABASE postgres SET app.cron_secret = 'your-secret-key-here';
   ```

3. **Run the migration**
   ```bash
   # Apply the migration that sets up pg_cron
   supabase migration up
   ```
   Or manually run `supabase/migrations/006_setup_techcrunch_cron.sql`

4. **Verify the cron job**
   ```sql
   -- Check scheduled jobs
   SELECT * FROM cron.job;
   
   -- Check job run history
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'techcrunch-scraper-hourly')
   ORDER BY start_time DESC
   LIMIT 10;
   ```

#### Troubleshooting pg_cron

If pg_cron is not available or you get permission errors:

1. **Enable pg_cron extension** (requires superuser):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

2. **Enable pg_net extension** (for HTTP requests):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

3. **If extensions are not available**, use Option 2 or 3 below.

### Option 2: External Cron Service (Easiest)

Use a free cron service like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [GitHub Actions](https://github.com/features/actions)

#### Setup with cron-job.org

1. **Create account** at https://cron-job.org
2. **Add new cron job**:
   - **URL**: `https://your-app.vercel.app/api/scrape-techcrunch`
   - **Method**: POST
   - **Headers**: 
     ```
     Authorization: Bearer your-cron-secret
     Content-Type: application/json
     ```
   - **Schedule**: Every hour (cron: `0 * * * *`)
   - **Time Zone**: Pacific Time (America/Los_Angeles)
   - **Active Hours**: 6:00 AM - 10:00 PM (16 hours)

3. **Set CRON_SECRET** in your Next.js environment variables:
   ```env
   CRON_SECRET=your-secret-key-here
   ```

#### Setup with GitHub Actions

Create `.github/workflows/techcrunch-scraper.yml`:

```yaml
name: TechCrunch Scraper

on:
  schedule:
    # Run every hour during TechCrunch active hours (6 AM - 10 PM Pacific)
    # Cron times in UTC: 13:00-22:00 UTC = 6 AM - 10 PM Pacific
    - cron: '0 13-22 * * *'
  workflow_dispatch: # Allow manual triggers

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Call Scraper API
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-app.vercel.app/api/scrape-techcrunch
```

### Option 3: Vercel Cron Jobs (If using Vercel)

1. **Add `vercel.json`** to your project root:
   ```json
   {
     "crons": [
       {
         "path": "/api/scrape-techcrunch",
         "schedule": "0 13-22 * * *"
       }
     ]
   }
   ```

2. **Set environment variable**:
   ```env
   CRON_SECRET=your-secret-key-here
   ```

3. **Deploy to Vercel** - cron jobs are automatically set up.

## Active Hours Configuration

The scraper automatically checks if it's within TechCrunch's active hours:
- **Start**: 6:00 AM Pacific Time
- **End**: 10:00 PM Pacific Time (22:00)
- **Duration**: 16 hours per day

If called outside these hours, the scraper will skip execution and log:
```
⏸️  Outside TechCrunch publishing hours. Pacific Time: 23:00 (⏸️  Inactive)
   Skipping this run. Will resume during active hours (6 AM - 10 PM Pacific).
```

## Security

### Protecting the API Endpoint

1. **Set CRON_SECRET** environment variable:
   ```env
   CRON_SECRET=your-random-secret-key-here
   ```

2. **Include in cron requests**:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer your-random-secret-key-here" \
     https://your-app.vercel.app/api/scrape-techcrunch
   ```

3. **The API route will reject requests** without the correct secret.

## Manual Testing

### Test the API endpoint:

```bash
# Test GET (info endpoint)
curl https://your-app.vercel.app/api/scrape-techcrunch

# Test POST (run scraper)
curl -X POST \
  -H "Authorization: Bearer your-cron-secret" \
  -H "Content-Type: application/json" \
  https://your-app.vercel.app/api/scrape-techcrunch

# Force run (ignores active hours check)
curl -X GET \
  "https://your-app.vercel.app/api/scrape-techcrunch?force=true" \
  -H "Authorization: Bearer your-cron-secret"
```

## Monitoring

### Check scraper runs:

1. **View logs** in your hosting platform (Vercel, Railway, etc.)
2. **Check Supabase** for new startups:
   ```sql
   SELECT 
     name,
     funding_amount,
     round_type,
     date,
     techcrunch_article_link,
     created_at
   FROM startups
   WHERE data_source = 'techcrunch'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Check cron job history** (if using pg_cron):
   ```sql
   SELECT 
     jobid,
     jobname,
     start_time,
     end_time,
     status,
     return_message
   FROM cron.job_run_details
   WHERE jobname = 'techcrunch-scraper-hourly'
   ORDER BY start_time DESC
   LIMIT 20;
   ```

## Schedule Details

- **Frequency**: Every hour
- **Active Hours**: 6 AM - 10 PM Pacific (16 hours/day)
- **Runs per day**: ~16 runs/day
- **Minimum interval**: 55 minutes between runs (prevents overlapping)

## Troubleshooting

### Scraper not running

1. **Check if within active hours**:
   - The scraper skips runs outside 6 AM - 10 PM Pacific
   - Use `?force=true` to test outside hours

2. **Check minimum interval**:
   - Scraper requires 55 minutes between runs
   - If called too frequently, it will skip

3. **Check logs**:
   - Look for error messages in your hosting platform
   - Check Supabase logs if using pg_cron

### API returns 401 Unauthorized

- Make sure `CRON_SECRET` is set in your environment
- Include `Authorization: Bearer <secret>` header in requests

### pg_cron not working

- Verify pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check if you have superuser privileges
- Consider using external cron service (Option 2) instead

## Updating the Schedule

To change the schedule, update the cron expression:

```sql
-- Unschedule old job
SELECT cron.unschedule('techcrunch-scraper-hourly');

-- Schedule new job (example: every 2 hours)
SELECT cron.schedule(
  'techcrunch-scraper-hourly',
  '0 */2 * * *', -- Every 2 hours
  $$SELECT call_techcrunch_scraper_v2();$$
);
```

## Cost Considerations

- **API Calls**: Gemini API for embeddings (~$0.0001 per article)
- **Database**: Supabase storage and queries
- **Pinecone**: Vector storage (if used)
- **Hosting**: Vercel/Railway/etc. execution time

Running hourly during active hours (16 runs/day) is cost-effective while keeping data fresh.

