# Enrichment Quality Grading System

## Overview

The enrichment quality system grades the success of startup data enrichment based on:
- **Field completeness** (critical vs important vs optional fields)
- **Confidence scores** (from LLM validation)
- **Data validation results**

This replaces the previous binary pass/fail system with a nuanced quality assessment.

## Quality Levels

### Excellent (Score ≥ 0.8)
- All critical fields found with high confidence (≥ 0.7)
- Most important fields found
- Ready for production use

### Good (Score ≥ 0.6)
- At least 70% of critical fields found
- Most important fields present
- Suitable for most use cases

### Fair (Score ≥ 0.4)
- At least 50% of critical fields found
- Some important fields missing
- May need manual review

### Poor (Score ≥ 0.2)
- Few critical fields found
- Low confidence scores
- Needs retry or manual intervention

### Failed (Score < 0.2)
- No critical fields found
- Exception thrown during enrichment
- Requires investigation

## Field Categories

### Critical Fields (Weight: 50%)
Must-have fields for basic enrichment:
- `founder_names`
- `website`
- `description`

### Important Fields (Weight: 30%)
Should-have fields for good enrichment:
- `founder_linkedin`
- `founder_emails`
- `job_openings`
- `funding_amount`
- `location`
- `industry`

### Optional Fields (Weight: 20%)
Nice-to-have fields:
- `tech_stack`
- `target_customer`
- `market_vertical`
- `team_size`
- `founder_backgrounds`
- `funding_stage`

## Enrichment Status

Based on quality assessment:

- **`completed`**: Quality is "good" or "excellent" (score ≥ 0.4)
- **`needs_review`**: Quality is "poor" or "fair" (score 0.2-0.4)
- **`failed`**: Quality is "failed" or exception thrown (score < 0.2)

## Database Schema

New columns added in migration `008_add_enrichment_quality.sql`:

```sql
enrichment_quality_score FLOAT      -- 0.0 to 1.0
enrichment_quality_status TEXT      -- excellent, good, fair, poor, failed
```

## Usage

### In Agentic Enrichment

The agentic enrichment system automatically:
1. Calculates quality after each enrichment attempt
2. Updates `enrichment_quality_score` and `enrichment_quality_status`
3. Sets `enrichment_status` based on quality
4. Keeps `needs_enrichment=true` for failed/poor quality startups

### In Simple Enricher

The simple enricher:
1. Estimates confidence scores (0.75 for LLM-extracted data)
2. Calculates quality using the same system
3. Updates quality metrics in database

### Querying by Quality

```sql
-- Find startups with poor quality that need retry
SELECT * FROM startups 
WHERE enrichment_quality_status IN ('poor', 'failed')
  AND needs_enrichment = true;

-- Find startups with excellent quality
SELECT * FROM startups 
WHERE enrichment_quality_status = 'excellent';

-- Find startups needing review
SELECT * FROM startups 
WHERE enrichment_status = 'needs_review';
```

## Quality Calculation

The overall score is calculated as:

```
Score = (Critical Fields Found / Total Critical) × 0.5
      + (Important Fields Found / Total Important) × 0.3
      + (Optional Fields Found / Total Optional) × 0.2
```

Each field is considered "found" if:
- It exists in the startup record (existing or extracted)
- Confidence score meets threshold (0.7 for critical, 0.6 for important, 0.5 for optional)

## Retry Logic

Startups are automatically retried if:
- Quality status is "failed" (always retry)
- Quality status is "poor" and attempts < 3
- Quality status is "fair" but missing critical fields and attempts < 2

## Integration

Both enrichment systems use the same quality assessment:

- **`yc_companies/enrichment_quality.ts`**: Core quality calculation module
- **`yc_companies/agentic_enrichment.ts`**: Uses quality for agentic workflow
- **`yc_companies/enrich_startup_data.ts`**: Uses quality for simple enrichment

## Benefits

1. **Better failure detection**: Identifies poor quality data, not just exceptions
2. **Retry logic**: Automatically retries failed/poor quality startups
3. **Quality metrics**: Track enrichment success rates over time
4. **Prioritization**: Focus manual review on "needs_review" startups
5. **Transparency**: Clear quality scores and status for each startup

## Migration

Run the migration to add quality tracking columns:

```bash
# Apply migration
supabase migration up 008_add_enrichment_quality
```

The system gracefully handles missing columns (falls back to status-only updates).

