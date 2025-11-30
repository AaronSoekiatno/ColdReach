# Full Agentic Workflow - How It Reasons and Finds Data

## The Core Principle

The agent **REASONS** about:
1. **WHAT** data is missing
2. **WHERE** to find it (which sources)
3. **HOW** to search for it (adaptive queries)
4. **IF** found data matches and is relevant
5. **WHETHER** more searches are needed

## The Complete Agentic Loop

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: REASON about missing data                           │
│ "What information do we need? What's most important?"      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: REASON about WHERE and HOW to find it              │
│ "Founders? → LinkedIn, company about page, Crunchbase"     │
│ "Website? → General search, company name + 'official'"     │
│ "Jobs? → Careers page, LinkedIn jobs"                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Generate adaptive search queries                    │
│ Based on reasoning, not hardcoded patterns                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Execute searches                                     │
│ Uses Gemini Grounding (via GEMINI_API_KEY) or DuckDuckGo    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: UNDERSTAND if results are relevant                  │
│ "Are these results about the correct company?"              │
│ "Do they contain what we're looking for?"                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Extract data intelligently                          │
│ Uses LLM to understand context, not just regex              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: VALIDATE extracted data                             │
│ "Is this data correct? Does it match the company?"         │
│ "Are there any errors?"                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: DECIDE if more searches needed                      │
│ "Do we have enough? Should we try different sources?"       │
└─────────────────────────────────────────────────────────────┘
                        ↓
                    [LOOP]
```

## Key Differences from Rule-Based Approach

### Before (Rule-Based)
```typescript
// Fixed query, no reasoning
const query = `${companyName} founder CEO co-founder`;
const results = await searchWeb(query);

// Regex extraction, no understanding
const names = text.match(/(?:founder)\s+([A-Z][a-z]+)/gi);
```

### After (Agentic)
```typescript
// 1. REASON about what's missing
const missing = await analyzeMissingData(startup);
// → "Missing: founder_names, founder_linkedin (high priority)"

// 2. REASON about WHERE to find it
const plan = await generateSearchPlan(startup, missing);
// → "Founders: Search LinkedIn, company about page, Crunchbase"
// → "Generate queries: 'company founder LinkedIn', 'company team about'"

// 3. UNDERSTAND if results match
const relevance = await checkRelevance(results, query, startup);
// → "These results are about the correct company (confidence: 0.9)"

// 4. VALIDATE extracted data
const validation = await validateExtractedData(extracted, 'founder_names', startup);
// → "Data is valid and matches the company (confidence: 0.95)"
```

## Example: Full Agentic Flow

### Startup: "Acme Corp"
**Missing**: founder_names, founder_linkedin, website

```
[STEP 1: REASON]
→ "Missing: founder_names (high), founder_linkedin (high), website (medium)"
→ "Founder info is critical for outreach"

[STEP 2: REASON about WHERE]
→ "Founders likely on: LinkedIn, company about page, Crunchbase, news articles"
→ "Website: General search, company name + 'official website'"

[STEP 3: Generate Queries]
→ Query 1: "Acme Corp founder LinkedIn" (priority: 1, source: linkedin)
→ Query 2: "Acme Corp team about founders" (priority: 2, source: company_website)
→ Query 3: "Acme Corp Crunchbase founders" (priority: 3, source: crunchbase)

[STEP 4: Search]
→ Executes Query 1: Found 10 results

[STEP 5: UNDERSTAND relevance]
→ "Results 1-3 are about Acme Corp (confidence: 0.95)"
→ "Results 4-10 are about different companies (confidence: 0.2)"
→ "Extracted: founder_names='John Doe, Jane Smith'"

[STEP 6: Extract]
→ Uses LLM to extract: "John Doe, Jane Smith" from relevant results

[STEP 7: VALIDATE]
→ "Names match company description (confidence: 0.9)"
→ "Format is correct (confidence: 0.95)"
→ "No issues found"

[STEP 8: DECIDE]
→ "Still missing: founder_linkedin, website"
→ "Continue searching (attempt 1/5)"

[LOOP BACK TO STEP 2]
→ Generate new queries for missing fields
→ ...
```

## How It Knows WHERE to Find Data

The agent reasons about data sources:

| Data Type | Likely Sources | Reasoning |
|-----------|---------------|-----------|
| **Founder Names** | LinkedIn, company about page, Crunchbase, news | Founders are public figures, listed on professional networks |
| **Founder LinkedIn** | LinkedIn search, company team page | LinkedIn is the primary professional network |
| **Founder Emails** | Company website contact, LinkedIn, email finder | Emails are often on contact/about pages |
| **Website** | General search, company name + "official" | Official website ranks high in search |
| **Job Openings** | Company careers page, LinkedIn jobs, job boards | Jobs are posted on company sites and job boards |
| **Funding Info** | Crunchbase, TechCrunch, news articles | Funding is covered by business news |
| **Tech Stack** | Company blog, GitHub, job postings | Tech info appears in engineering content |

## How It Understands Relevance

The agent checks:
1. **Company Match**: "Are these results about the correct company?"
2. **Content Match**: "Do they contain what we're looking for?"
3. **Confidence**: "How sure are we this is correct?"

Example:
```
Query: "Acme Corp founder"
Results: 
  - "Acme Corp - Founded by John Doe" ✅ (confidence: 0.95)
  - "Acme Industries - CEO Jane Smith" ❌ (confidence: 0.2, different company)
  - "Acme Corp raises $10M" ⚠️ (confidence: 0.6, mentions company but no founder)
```

## How It Validates Data

The agent validates:
1. **Correctness**: "Is this data about the right company?"
2. **Format**: "Is the format correct? (email, URL, etc.)"
3. **Completeness**: "Is this complete information?"
4. **Consistency**: "Does this match other data we have?"

Example:
```
Extracted: founder_names = "John Doe"
Validation:
  ✅ Matches company description (confidence: 0.9)
  ✅ Format is correct (confidence: 0.95)
  ⚠️  Only one founder found, might be incomplete (confidence: 0.7)
  → Decision: Accept but flag as potentially incomplete
```

## Usage

### Run Agentic Enrichment
```bash
# Enrich a specific startup with full agentic workflow
npm run enrich-agentic -- --id=<startup_id>
```

### Compare with Basic Enrichment
```bash
# Basic enrichment (rule-based)
npm run enrich-startup -- --id=<startup_id>

# Agentic enrichment (reasoning-based)
npm run enrich-agentic -- --id=<startup_id>
```

## Benefits

1. **Intelligent**: Reasons about what to search, not just executes fixed queries
2. **Adaptive**: Adjusts strategy based on results
3. **Validates**: Ensures data is correct and relevant
4. **Efficient**: Stops when enough data is found
5. **Transparent**: Shows reasoning at each step

## Files

- `yc_companies/reasoning_agent.ts` - Core reasoning functions
- `yc_companies/agentic_enrichment.ts` - Main orchestrator
- `yc_companies/web_search_agent.ts` - Search and extraction (already updated with LLM)

## Next Steps

1. Test on a startup: `npm run enrich-agentic -- --id=<id>`
2. Compare results with basic enrichment
3. Monitor reasoning and validation quality
4. Iterate on prompts for better reasoning

