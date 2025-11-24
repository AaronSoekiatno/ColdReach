# CSV Ingestion Script

This script ingests startup data from the CSV file into HelixDB.

## Prerequisites

1. **HelixDB Server Running**: Make sure HelixDB is running locally or accessible
   ```bash
   helix deploy --local
   ```

2. **Environment Variables**: Create a `.env.local` file (or set environment variables):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   HELIX_URL=http://localhost:6969  # Optional, defaults to localhost:6969
   HELIX_API_KEY=your_helix_api_key  # Optional, only needed for cloud deployment
   ```

3. **Schema Deployed**: Ensure the schema in `db/schema.hx` and queries in `db/queries.hx` are deployed to HelixDB.

## Usage

Run the ingestion script:

```bash
npm run ingest
```

Or directly with tsx:

```bash
npx tsx scripts/ingest-csv.ts
```

## What the Script Does

1. **Parses CSV**: Reads `yc_companies/FINAL_DATASET - FINAL_DATASET.csv (1).csv`

2. **Filters Data**: Skips rows marked with `🤖 PATTERN` in the `data_quality` column

3. **Generates Embeddings**: Uses Google Gemini's `text-embedding-004` model to create embeddings for:
   - Company description
   - Tags (derived from business_type and industry)

4. **Creates Nodes**:
   - **Startup nodes**: With name, description, industry, location, website, tags, funding info, and embeddings
   - **Founder nodes**: With first name, last name, email, and LinkedIn (unique by email)
   - **FundingRound nodes**: With stage, amount, date, and batch (unique by ID)

5. **Creates Edges**:
   - `HasFounder`: Links startups to their founders
   - `HasFundingRound`: Links startups to their funding rounds

## Data Mapping

| CSV Column | HelixDB Field | Notes |
|------------|---------------|-------|
| Company_Name | Startup.name | INDEX field |
| company_description | Startup.description | Used for embeddings |
| business_type + industry | Startup.tags | Combined into comma-separated string |
| industry | Startup.industry | |
| location | Startup.location | |
| website | Startup.website | |
| funding_stage | Startup.funding_stage, FundingRound.stage | |
| amount_raised | Startup.funding_amount, FundingRound.amount | |
| date_raised | FundingRound.date_raised | |
| Batch | FundingRound.batch | |
| founder_first_name | Founder.first_name | |
| founder_last_name | Founder.last_name | |
| founder_email | Founder.email | INDEX field (unique) |
| founder_linkedin | Founder.linkedin | |

## Error Handling

- The script continues processing even if individual rows fail
- Errors are logged but don't stop the entire ingestion
- A summary is printed at the end showing success/error counts

## Performance

- Includes a 100ms delay between rows to avoid API rate limiting
- Embedding generation may take time depending on Gemini API limits
- Estimated time: ~10-15 seconds per startup (with API delays)

