# Scraper Schedule Configuration

## Current Schedule: 30 Minutes (Active Hours Only)

The scraper is configured to run **every 30 minutes** but **only during TechCrunch's active publishing hours**.

## Active Hours

**TechCrunch Publishing Hours:**
- **Start**: 6:00 AM Pacific Time
- **End**: 10:00 PM Pacific Time (22:00)
- **Duration**: 16 hours per day

**Why These Hours?**
- TechCrunch publishes most articles during US business hours
- Covers morning news cycle (6 AM - 9 AM)
- Covers business day (9 AM - 5 PM)
- Covers evening news cycle (5 PM - 10 PM)
- Reduces unnecessary scraping during off-hours

## Schedule Behavior

### During Active Hours (6 AM - 10 PM Pacific)
- ✅ Scraper runs every 30 minutes
- ✅ Processes new funding articles
- ✅ Saves to Supabase + Pinecone

### Outside Active Hours (10 PM - 6 AM Pacific)
- ⏸️  Scraper skips runs
- ⏸️  Logs: "Outside TechCrunch publishing hours"
- ⏸️  No API calls, no browser launches
- ⏸️  Saves resources

## Daily Run Count

**Active Hours**: 16 hours/day
**Runs per hour**: 2 (every 30 minutes)
**Total runs per day**: 32 runs/day

**Previous (10-min, 24/7)**: 144 runs/day
**Current (30-min, active hours)**: 32 runs/day
**Reduction**: 78% fewer runs! 🎉

## Timezone Handling

The scraper automatically converts to Pacific Time to check active hours:
- Uses `America/Los_Angeles` timezone
- Accounts for daylight saving time
- Works correctly regardless of server timezone

## Example Schedule

**Monday, 6:00 AM Pacific** → ✅ First run of the day
**Monday, 6:30 AM Pacific** → ✅ Second run
**Monday, 7:00 AM Pacific** → ✅ Third run
...
**Monday, 9:30 PM Pacific** → ✅ Last run of the day
**Monday, 10:00 PM Pacific** → ⏸️  Skipped (outside hours)
**Monday, 11:00 PM Pacific** → ⏸️  Skipped
**Tuesday, 5:00 AM Pacific** → ⏸️  Skipped
**Tuesday, 6:00 AM Pacific** → ✅ First run of new day

## Configuration

To change the active hours, edit the `isWithinTechCrunchHours()` function:

```typescript
function isWithinTechCrunchHours(): boolean {
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacificTime.getHours();
  
  // Change these values to adjust active hours
  return hour >= 6 && hour < 22; // 6 AM - 10 PM
}
```

## Benefits

1. **78% Fewer Runs** - Reduces load significantly
2. **Lower Rate Limit Risk** - Less likely to trigger TechCrunch blocking
3. **Resource Efficient** - No scraping during off-hours
4. **Still Fresh** - 30-minute intervals catch articles quickly
5. **Cost Effective** - Fewer API calls, lower costs

## Monitoring

The scraper logs:
- ✅ Active/Inactive status
- ⏰ Pacific Time when run starts
- 📅 Full timestamp in ISO format

Example output:
```
⏰ Pacific Time: 14:30 (✅ Active)
📅 Run started at: 2025-11-22T21:30:00.000Z
```

## Cron/Scheduler Setup

If using cron or a scheduler, you can still schedule every 30 minutes:

```bash
# Cron: Every 30 minutes
*/30 * * * * cd /path/to/project && npm run scrape-techcrunch-supabase
```

The scraper will automatically skip runs outside active hours.

## Manual Override

To force a run outside active hours (for testing), you can temporarily modify the function or add an environment variable:

```typescript
// Add to .env.local
FORCE_SCRAPE=true

// In code
if (process.env.FORCE_SCRAPE === 'true' || isWithinTechCrunchHours()) {
  // Run scraper
}
```

