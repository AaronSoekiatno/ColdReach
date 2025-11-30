# Founder Email Discovery - Solutions & Recommendations

## Problem Statement
1. **Limited email discovery**: Only searches general web results, misses specialized sources
2. **Single email storage**: Database schema only supports one comma-separated string
3. **No fallback hierarchy**: No systematic approach to finding emails before using paid Hunter.io API
4. **Multiple founders**: Companies often have 2-4 co-founders, but we can only store them as a CSV string

---

## Solution Overview

### Enhanced Email Discovery Pipeline ✅

**Tiered Approach** (try free sources first, paid API last):

```
Tier 1: Public Sources (Free)
├─ Company website (team/about pages)
├─ LinkedIn profiles
├─ GitHub profiles (devs list emails)
└─ Company blog author bios

Tier 2: Specialized Aggregators (Free)
├─ AngelList / Wellfound
├─ Product Hunt maker profiles
└─ Crunchbase (limited free)

Tier 3: Paid Fallback
└─ Hunter.io API (only if Tiers 1-2 fail)
```

**Implementation**: `yc_companies/founder_email_discovery.ts` (already created)

---

## Database Schema Options

### Option A: Separate Founders Table (⭐ RECOMMENDED)

**Pros:**
- Proper relational normalization
- Easy to query individual founders
- Can store unlimited founders per startup
- Each founder gets their own fields (email, LinkedIn, role, background)
- Easy to add new founder-specific fields later
- Can track email source for confidence

**Cons:**
- Requires migration
- More complex queries (joins needed)
- Breaking change for existing code

**Migration:**
```sql
-- File: supabase/migrations/008_add_founders_table.sql

CREATE TABLE founders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  role TEXT, -- e.g., "CEO", "CTO", "Co-Founder"
  background TEXT, -- previous companies/education
  email_source TEXT, -- 'website', 'linkedin', 'github', 'angellist', 'hunter.io'
  email_confidence FLOAT, -- 0.0 - 1.0
  is_primary BOOLEAN DEFAULT false, -- Mark CEO or primary founder
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_founders_startup_id ON founders(startup_id);
CREATE INDEX idx_founders_email ON founders(email) WHERE email IS NOT NULL;
CREATE INDEX idx_founders_is_primary ON founders(is_primary) WHERE is_primary = true;

-- Add trigger for updated_at
CREATE TRIGGER update_founders_updated_at
  BEFORE UPDATE ON founders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Keep old columns for backwards compatibility during migration
-- Can drop these after confirming everything works
-- ALTER TABLE startups DROP COLUMN founder_names;
-- ALTER TABLE startups DROP COLUMN founder_emails;
-- ALTER TABLE startups DROP COLUMN founder_linkedin;
```

**Usage Example:**
```typescript
// Insert founders
const founders = [
  {
    startup_id: startupId,
    full_name: "John Doe",
    email: "john@company.com",
    linkedin_url: "linkedin.com/in/johndoe",
    role: "CEO",
    email_source: "linkedin",
    email_confidence: 0.9,
    is_primary: true
  },
  {
    startup_id: startupId,
    full_name: "Jane Smith",
    email: "jane@company.com",
    linkedin_url: "linkedin.com/in/janesmith",
    role: "CTO",
    email_source: "website",
    email_confidence: 0.95,
    is_primary: false
  }
];

await supabase.from('founders').insert(founders);

// Query startups with founders
const { data } = await supabase
  .from('startups')
  .select(`
    *,
    founders (*)
  `)
  .eq('id', startupId);
```

---

### Option B: JSONB Column (Good middle ground)

**Pros:**
- Single column, no joins needed
- Can store unlimited founders
- Flexible schema (easy to add fields)
- PostgreSQL has excellent JSONB support
- Can still index and query

**Cons:**
- Less type-safe than separate table
- More complex validation needed
- JSONB queries are less intuitive

**Migration:**
```sql
-- File: supabase/migrations/008_add_founders_jsonb.sql

ALTER TABLE startups
  ADD COLUMN founders_data JSONB,
  ADD COLUMN founder_emails_array TEXT[]; -- For easy email queries

-- Create index for JSONB queries
CREATE INDEX idx_startups_founders_data ON startups USING gin(founders_data);
CREATE INDEX idx_startups_founder_emails_array ON startups USING gin(founder_emails_array);

-- Example JSONB structure:
-- {
--   "founders": [
--     {
--       "name": "John Doe",
--       "email": "john@company.com",
--       "linkedin": "linkedin.com/in/johndoe",
--       "role": "CEO",
--       "emailSource": "linkedin",
--       "emailConfidence": 0.9,
--       "isPrimary": true
--     },
--     {
--       "name": "Jane Smith",
--       "email": "jane@company.com",
--       "linkedin": "linkedin.com/in/janesmith",
--       "role": "CTO",
--       "emailSource": "website",
--       "emailConfidence": 0.95,
--       "isPrimary": false
--     }
--   ]
-- }
```

**Usage Example:**
```typescript
// Insert with JSONB
await supabase
  .from('startups')
  .update({
    founders_data: {
      founders: [
        {
          name: "John Doe",
          email: "john@company.com",
          linkedin: "linkedin.com/in/johndoe",
          role: "CEO",
          emailSource: "linkedin",
          emailConfidence: 0.9,
          isPrimary: true
        }
      ]
    },
    founder_emails_array: ["john@company.com"] // For easy queries
  })
  .eq('id', startupId);

// Query founders with specific email
const { data } = await supabase
  .from('startups')
  .select('*')
  .contains('founder_emails_array', ['john@company.com']);
```

---

### Option C: Minimal Change - Enhanced CSV Storage

**Pros:**
- No migration needed
- Works with existing code
- Quick to implement

**Cons:**
- Still limited to CSV parsing
- Can't query individual founders easily
- No proper type safety
- Can't store metadata (source, confidence)
- Ugly to work with

**Migration:**
```sql
-- File: supabase/migrations/008_add_founder_metadata.sql

ALTER TABLE startups
  ADD COLUMN founder_roles TEXT, -- "CEO, CTO"
  ADD COLUMN founder_email_sources TEXT; -- "linkedin, website"
```

**Not recommended** - just upgrading existing limitations

---

## Recommended Implementation Plan

### Step 1: Add Enhanced Email Discovery (Immediate - No DB changes)
- Use `founder_email_discovery.ts`
- Update `enrich_startup_data.ts` to call `discoverFounderEmails()`
- Store results in existing CSV fields for now
- Log which tier found each email (for analytics)

### Step 2: Database Migration (Option A - Separate Table)
- Create `founders` table with proper schema
- Migrate existing CSV data to new table
- Update all queries to use joins
- Keep old columns for 1-2 weeks as backup
- Drop old columns after confirmation

### Step 3: Update Enrichment Workflow
```typescript
// In enrich_startup_data.ts
const emailResult = await discoverFounderEmails(
  startup.name,
  startup.website,
  true // enable Hunter.io fallback
);

// Insert founders into new table
for (const founder of emailResult.founders) {
  await supabase.from('founders').insert({
    startup_id: startup.id,
    full_name: founder.name,
    email: founder.email,
    linkedin_url: founder.linkedin,
    role: founder.role,
    background: founder.background,
    email_source: founder.emailSource,
    email_confidence: founder.confidence,
    is_primary: founder === emailResult.primaryFounder
  });
}
```

---

## Cost Analysis

### Free Sources (Tiers 1-2)
- **Cost**: $0
- **Rate Limits**: DuckDuckGo rate limits (handle with retries)
- **Expected Coverage**: ~60-70% of startups

### Hunter.io (Tier 3)
- **Free Plan**: 25 searches/month
- **Starter**: $49/month = 500 searches
- **Growth**: $99/month = 2,500 searches
- **Business**: $199/month = 10,000 searches

**Recommendation**: Use free tiers first, only enable Hunter.io for high-priority startups

---

## Questions for You

1. **Database Schema**: Do you prefer Option A (separate table) or Option B (JSONB)?
   - Option A is more traditional/proper
   - Option B is more flexible

2. **Hunter.io**: Do you have an API key? Should we enable Tier 3 fallback?

3. **Migration Timeline**: When can we do the database migration?
   - Need to update existing code that reads founder fields
   - Can do gradual migration (new table + old CSV columns both exist)

4. **Priority**: Which is more important?
   - Finding more emails (better discovery)
   - Storing multiple founders properly (better schema)
   - Both equally important

Let me know your preferences and I can proceed with implementation!
