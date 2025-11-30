# Supabase Cron Setup Guide

**Yes, you CAN use Supabase for the cron job!** This guide shows you exactly how.

## Why Supabase Works Great

✅ **pg_cron is built-in** - Supabase supports the pg_cron extension  
✅ **pg_net for HTTP requests** - Can call your Next.js API endpoint  
✅ **No external services needed** - Everything runs in your database  
✅ **Free tier available** - Works on Supabase free tier  
✅ **Easy monitoring** - View job runs in Supabase Dashboard  

## Quick Setup (5 minutes)

### Step 1: Enable Extensions

1. Go to your Supabase Dashboard
2. Navigate to **Database → Extensions**
3. Search and enable:
   - ✅ **pg_cron**
   - ✅ **pg_net**

### Step 2: Set Your API URL and Secret

You have two options:

#### Option A: Using Supabase Vault (Recommended - More Secure)

Run in SQL Editor:

```sql
-- Set your deployed Next.js API URL
SELECT vault.create_secret(
  'https://your-app.vercel.app/api/scrape-techcrunch',
  'techcrunch_api_url'
);

-- Set your cron secret (optional, for API authentication)
SELECT vault.create_secret(
  'your-random-secret-key-here',
  'techcrunch_cron_secret'
);
```

#### Option B: Using Database Settings (Simpler, Less Secure)

Run in SQL Editor:

```sql
-- Set your deployed Next.js API URL
ALTER DATABASE postgres 
SET app.techcrunch_api_url = 'https://your-app.vercel.app/api/scrape-techcrunch';

-- Set your cron secret (optional)
ALTER DATABASE postgres 
SET app.cron_secret = 'your-random-secret-key-here';
```

### Step 3: Run the Migration

Apply the migration:

```bash
supabase migration up
```

Or manually run `supabase/migrations/006_setup_techcrunch_cron.sql` in the SQL Editor.

### Step 4: Verify It's Working

Check if the cron job is scheduled:

```sql
SELECT * FROM cron.job 
WHERE jobname = 'techcrunch-scraper-hourly';
```

You should see a job scheduled to run hourly from 13:00-22:00 UTC.

## How It Works

```
┌─────────────────┐
│  Supabase       │
│  pg_cron        │ (Runs every hour)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  call_techcrunch│
│  _scraper()     │ (Database function)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  pg_net         │ (Makes HTTP request)
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
└─────────────────┘
```

## Monitoring

### View Scheduled Jobs

```sql
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname = 'techcrunch-scraper-hourly';
```

### View Job Execution History

```sql
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  end_time - start_time as duration
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'techcrunch-scraper-hourly'
)
ORDER BY start_time DESC
LIMIT 20;
```

### View HTTP Request Results (pg_net)

```sql
SELECT 
  id,
  status_code,
  content_type,
  content,
  error_msg,
  created
FROM net._http_response
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC;
```

### Check for Errors

```sql
SELECT 
  jobid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE status != 'succeeded'
  AND start_time > NOW() - INTERVAL '7 days'
ORDER BY start_time DESC;
```

## Troubleshooting

### Issue: "extension pg_cron does not exist"

**Solution**: Enable pg_cron in Dashboard:
1. Go to Database → Extensions
2. Search "pg_cron"
3. Click Enable

### Issue: "extension pg_net does not exist"

**Solution**: Enable pg_net in Dashboard:
1. Go to Database → Extensions
2. Search "pg_net"
3. Click Enable

### Issue: "techcrunch_api_url not set"

**Solution**: Set the API URL using one of the methods in Step 2 above.

### Issue: Cron job not running

**Check 1**: Is pg_cron scheduler active?

```sql
SELECT 
  pid,
  usename,
  application_name,
  state,
  query
FROM pg_stat_activity 
WHERE application_name ILIKE 'pg_cron scheduler';
```

If no rows returned, the scheduler is down. Try:
- Fast reboot in Dashboard → Settings → General
- Or contact Supabase support

**Check 2**: Are there too many concurrent jobs?

```sql
SELECT COUNT(*) 
FROM pg_stat_activity 
WHERE application_name ILIKE 'pg_cron';
```

pg_cron supports up to 32 concurrent jobs. If you have many, space them out.

**Check 3**: Check for errors in job_run_details:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'techcrunch-scraper-hourly')
  AND status != 'succeeded'
ORDER BY start_time DESC
LIMIT 5;
```

### Issue: HTTP requests failing

Check pg_net response table:

```sql
SELECT 
  id,
  status_code,
  error_msg,
  content,
  created
FROM net._http_response
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC;
```

Common issues:
- **401 Unauthorized**: Check that `CRON_SECRET` matches in both places
- **404 Not Found**: Check that API URL is correct
- **Timeout**: Increase timeout in the function (currently 5 minutes)

## Schedule Customization

### Change Schedule

```sql
-- Unschedule old job
SELECT cron.unschedule('techcrunch-scraper-hourly');

-- Schedule new job (example: every 2 hours)
SELECT cron.schedule(
  'techcrunch-scraper-hourly',
  '0 */2 * * *', -- Every 2 hours
  $$SELECT call_techcrunch_scraper();$$
);
```

### Run Every 30 Minutes (Instead of Hourly)

```sql
SELECT cron.unschedule('techcrunch-scraper-hourly');

SELECT cron.schedule(
  'techcrunch-scraper-hourly',
  '*/30 13-22 * * *', -- Every 30 minutes from 13:00-22:00 UTC
  $$SELECT call_techcrunch_scraper();$$
);
```

### Adjust for Daylight Saving Time

Pacific Time offset changes:
- **PST (Winter)**: UTC-8 → 6 AM Pacific = 14:00 UTC, 10 PM = 06:00 UTC next day
- **PDT (Summer)**: UTC-7 → 6 AM Pacific = 13:00 UTC, 10 PM = 05:00 UTC next day

Current schedule `0 13-22 * * *` covers both, but you may want to adjust:

```sql
-- For PST (November - March)
SELECT cron.schedule(
  'techcrunch-scraper-pst',
  '0 14-23,0-5 * * *', -- 14:00-23:59 and 00:00-05:59 UTC
  $$SELECT call_techcrunch_scraper();$$
);

-- For PDT (March - November)  
SELECT cron.schedule(
  'techcrunch-scraper-pdt',
  '0 13-22 * * *', -- 13:00-22:00 UTC
  $$SELECT call_techcrunch_scraper();$$
);
```

## Advantages of Supabase Cron

✅ **No external dependencies** - Everything in one place  
✅ **Free tier support** - Works on free Supabase plan  
✅ **Built-in monitoring** - View runs in Dashboard  
✅ **Reliable** - Uses battle-tested pg_cron  
✅ **Secure** - Can use Supabase Vault for secrets  
✅ **Easy debugging** - SQL queries to check status  

## Next Steps

1. ✅ Enable extensions (pg_cron, pg_net)
2. ✅ Set API URL and secret
3. ✅ Run migration
4. ✅ Verify job is scheduled
5. ✅ Monitor first few runs
6. ✅ Check Supabase logs if issues occur

## Resources

- [Supabase Cron Docs](https://supabase.com/docs/guides/cron)
- [pg_cron Extension](https://supabase.com/docs/guides/database/extensions/pgcron)
- [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pgnet)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)

