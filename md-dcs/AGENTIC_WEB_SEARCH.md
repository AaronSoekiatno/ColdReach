# Agentic Web Search Architecture

## Current Implementation (Rule-Based)

### How It Works Now

```
1. Fixed Query Generation
   └─> "{companyName} founder CEO co-founder"
   
2. Search API Call
   └─> Returns raw search results (title, URL, snippet)
   
3. Regex Pattern Matching
   └─> Extracts data using hardcoded patterns
   └─> No understanding of context or ambiguity
   
4. Simple Merge
   └─> Updates database if patterns match
```

**Limitations:**
- ❌ Can't adapt queries based on results
- ❌ Can't handle ambiguous or complex information
- ❌ No validation of extracted data
- ❌ No reasoning about what information is missing
- ❌ Brittle - breaks on unexpected formats

### Example Current Flow

```typescript
// enrich_startup_data.ts - Line 70-79
const founderQuery = `${companyName} founder CEO co-founder`;
const founderResults = await searchWeb(founderQuery);

// web_search_agent.ts - Line 153-195
// Uses regex patterns - no reasoning
const namePatterns = [
  /(?:founder|CEO|co-founder)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /([A-Z][a-z]+\s+[A-Z][a-z]+),\s*(?:founder|CEO|co-founder)/gi,
];
```

## Agentic Implementation (Proposed)

### How It Would Work

```
1. Reasoning Agent
   └─> Analyzes what information is missing
   └─> Decides what to search for
   └─> Generates optimal search queries
   
2. Search Execution
   └─> Executes search with generated queries
   
3. Evaluation Agent
   └─> Assesses result quality
   └─> Decides if more searches needed
   └─> Identifies conflicting information
   
4. Extraction Agent (LLM-Powered)
   └─> Uses LLM to understand context
   └─> Extracts structured data intelligently
   └─> Handles ambiguity and edge cases
   
5. Validation Agent
   └─> Validates extracted data
   └─> Cross-references multiple sources
   └─> Flags uncertain information
   
6. Decision Agent
   └─> Decides if enrichment is complete
   └─> Determines if retry is needed
   └─> Updates database with confidence scores
```

### Agentic Architecture

```typescript
// agentic_web_search.ts

interface AgentState {
  company: StartupRecord;
  missingFields: string[];
  searchHistory: SearchQuery[];
  extractedData: Partial<EnrichedData>;
  confidence: Record<string, number>;
  attempts: number;
}

/**
 * Main Agentic Orchestrator
 */
async function agenticEnrichStartup(
  startup: StartupRecord
): Promise<EnrichedData> {
  let state: AgentState = {
    company: startup,
    missingFields: identifyMissingFields(startup),
    searchHistory: [],
    extractedData: {},
    confidence: {},
    attempts: 0,
  };

  // Agent Loop - continues until goal is met or max attempts
  while (state.attempts < MAX_ATTEMPTS && !isEnrichmentComplete(state)) {
    // 1. REASONING AGENT: Decide what to search
    const searchPlan = await reasoningAgent(state);
    
    // 2. SEARCH AGENT: Execute searches
    const results = await searchAgent(searchPlan);
    state.searchHistory.push(...results);
    
    // 3. EVALUATION AGENT: Assess result quality
    const evaluation = await evaluationAgent(results, state);
    
    // 4. EXTRACTION AGENT: Extract with LLM
    const extracted = await extractionAgent(results, state);
    
    // 5. VALIDATION AGENT: Validate and cross-reference
    const validated = await validationAgent(extracted, state);
    
    // 6. UPDATE STATE
    state = updateState(state, validated);
    state.attempts++;
  }
  
  return state.extractedData;
}

/**
 * REASONING AGENT: Uses LLM to decide what to search
 */
async function reasoningAgent(state: AgentState): Promise<SearchPlan> {
  const prompt = `You are a research agent. Analyze what information is missing about this company and decide what to search for.

Company: ${state.company.name}
Description: ${state.company.description}
Missing Fields: ${state.missingFields.join(', ')}

Previous Searches: ${state.searchHistory.map(s => s.query).join(', ')}

Generate 3-5 specific search queries that will help find the missing information. Consider:
- What information is most critical?
- What search terms will yield best results?
- Should we search for founders, funding, jobs, or company details?

Return JSON:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Why these queries will help",
  "priority": "high" | "medium" | "low"
}`;

  const response = await llm.generate(prompt);
  return JSON.parse(response);
}

/**
 * EXTRACTION AGENT: Uses LLM to extract intelligently
 */
async function extractionAgent(
  results: SearchResult[],
  state: AgentState
): Promise<Partial<EnrichedData>> {
  const context = results
    .map(r => `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}`)
    .join('\n\n');

  const prompt = `Extract information about ${state.company.name} from these search results.

Search Results:
${context}

Extract the following information (return JSON):
{
  "founder_names": "Comma-separated names or empty string",
  "founder_linkedin": "LinkedIn profile URL or empty string",
  "founder_emails": "Email addresses or empty string",
  "website": "Official website domain or empty string",
  "job_openings": "Job titles or empty string",
  "funding_amount": "Funding amount or empty string",
  "tech_stack": "Technologies used or empty string",
  "confidence": {
    "founder_names": 0.0-1.0,
    "founder_linkedin": 0.0-1.0,
    ...
  }
}

Rules:
- Only extract information you're confident about
- If information is ambiguous, set confidence < 0.7
- Cross-reference multiple results for accuracy
- Return empty strings if information is not found`;

  const response = await llm.generate(prompt);
  return JSON.parse(response);
}

/**
 * VALIDATION AGENT: Validates and cross-references
 */
async function validationAgent(
  extracted: Partial<EnrichedData>,
  state: AgentState
): Promise<ValidatedData> {
  // Cross-reference with previous extractions
  // Check for conflicts
  // Validate formats (emails, URLs, etc.)
  // Calculate confidence scores
  
  const validated: ValidatedData = {};
  
  for (const [field, value] of Object.entries(extracted)) {
    if (value && extracted.confidence?.[field] > 0.7) {
      // Validate format
      if (field === 'founder_emails') {
        validated[field] = validateEmails(value);
      } else if (field === 'founder_linkedin') {
        validated[field] = validateLinkedIn(value);
      } else {
        validated[field] = value;
      }
      
      validated.confidence[field] = extracted.confidence[field];
    }
  }
  
  return validated;
}

/**
 * EVALUATION AGENT: Assesses if we need more searches
 */
async function evaluationAgent(
  results: SearchResult[],
  state: AgentState
): Promise<Evaluation> {
  const prompt = `Evaluate these search results for ${state.company.name}.

Results: ${results.length} found
Missing Fields: ${state.missingFields.join(', ')}

Are these results sufficient? Do we need to:
1. Search with different queries?
2. Search for more specific information?
3. Stop searching (have enough)?

Return JSON:
{
  "sufficient": boolean,
  "next_action": "search_more" | "extract" | "stop",
  "reasoning": "Why"
}`;

  const response = await llm.generate(prompt);
  return JSON.parse(response);
}
```

## Key Differences

### Current (Rule-Based)
```typescript
// Fixed query
const query = `${companyName} founder`;
const results = await searchWeb(query);

// Regex extraction
const names = text.match(/(?:founder)\s+([A-Z][a-z]+)/gi);
```

### Agentic (LLM-Powered)
```typescript
// Adaptive query generation
const reasoning = await llm.reason(`
  What should I search for to find founders of ${companyName}?
  Previous searches: ${searchHistory}
  Missing: ${missingFields}
`);

// Intelligent extraction
const extracted = await llm.extract(`
  From these results, extract founder information.
  Consider context, ambiguity, and multiple sources.
`);
```

## Benefits of Agentic Approach

1. **Adaptive**: Adjusts strategy based on results
2. **Intelligent**: Understands context and ambiguity
3. **Self-Correcting**: Validates and retries when needed
4. **Goal-Oriented**: Stops when sufficient information is found
5. **Robust**: Handles edge cases and unexpected formats
6. **Transparent**: Provides reasoning and confidence scores

## Implementation Plan

### Phase 1: Add LLM Extraction
- Replace regex with LLM-based extraction
- Keep current query generation
- Add confidence scores

### Phase 2: Add Reasoning
- LLM-based query generation
- Adaptive search strategy
- Result evaluation

### Phase 3: Full Agentic Loop
- Multi-agent orchestration
- Self-correction and validation
- Goal-oriented completion

## Example: Agentic Flow

```
Startup: "Acme Corp"
Missing: founder_names, founder_linkedin, website

[REASONING AGENT]
→ "I need to find founders. Let me search for:
   1. 'Acme Corp founder CEO'
   2. 'Acme Corp co-founder'
   3. 'Acme Corp team about'"

[SEARCH AGENT]
→ Executes 3 searches, gets 15 results

[EVALUATION AGENT]
→ "Results look good, but I need more specific founder info"

[EXTRACTION AGENT]
→ Uses LLM to extract:
   - founder_names: "John Doe, Jane Smith" (confidence: 0.9)
   - founder_linkedin: "linkedin.com/in/johndoe" (confidence: 0.8)
   - website: "" (confidence: 0.0)

[VALIDATION AGENT]
→ Validates LinkedIn URL format
→ Cross-references with other results
→ Confirms confidence scores

[DECISION AGENT]
→ "Website still missing, but founders found"
→ "Should I search for website? Yes, it's important"
→ Generates new query: "Acme Corp official website"

[LOOP CONTINUES...]
```

## Cost Considerations

- **Current**: ~$0.01 per startup (just API calls)
- **Agentic**: ~$0.10-0.50 per startup (LLM calls)
- **Benefit**: Much higher data quality and completeness

## Next Steps

1. Start with Phase 1: Replace extraction with LLM
2. Add confidence scores to database
3. Monitor quality improvements
4. Gradually add reasoning capabilities
5. Full agentic orchestration

