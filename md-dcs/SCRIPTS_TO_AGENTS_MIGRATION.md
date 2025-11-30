# Scripts to Agents Migration Guide

## Overview

This guide explains how to migrate from script-based code to agent-based architecture, making your code more modular, reusable, and orchestratable.

## Key Differences

### Scripts (Current Approach)
- **One-off execution**: Run from start to finish, then exit
- **Procedural**: Linear flow, hard to reuse parts
- **Tightly coupled**: All logic in one file
- **Example**: `scripts/ingest-csv-supabase.ts`

### Agents (Target Approach)
- **Modular**: Reusable components that can be orchestrated
- **Stateful**: Can maintain context and be called multiple times
- **Composable**: Agents can call other agents
- **Example**: `yc_companies/web_search_agent.ts` + `yc_companies/enrich_startup_data.ts`

## Migration Pattern

### Step 1: Identify Script Responsibilities

Break down your script into distinct responsibilities:

**Script Example** (`ingest-csv-supabase.ts`):
- CSV parsing
- Data validation/transformation
- Supabase insertion
- Embedding generation
- Pinecone storage

### Step 2: Extract Reusable Functions

Create agent modules with focused responsibilities:

```typescript
// agents/csv_parser_agent.ts
export async function parseCSVAgent(filePath: string): Promise<CSVRow[]> {
  // CSV parsing logic
}

// agents/data_transformer_agent.ts
export async function transformStartupDataAgent(row: CSVRow): Promise<StartupData> {
  // Data transformation logic
}

// agents/supabase_agent.ts
export async function insertStartupAgent(supabase: SupabaseClient, data: StartupData): Promise<string> {
  // Supabase insertion logic
}

// agents/embedding_agent.ts
export async function generateEmbeddingAgent(text: string): Promise<number[]> {
  // Embedding generation logic
}

// agents/pinecone_agent.ts
export async function storeEmbeddingAgent(id: string, embedding: number[], metadata: any): Promise<void> {
  // Pinecone storage logic
}
```

### Step 3: Create Orchestrator Agent

Create a main agent that coordinates the workflow:

```typescript
// agents/ingestion_orchestrator.ts
import { parseCSVAgent } from './csv_parser_agent';
import { transformStartupDataAgent } from './data_transformer_agent';
import { insertStartupAgent } from './supabase_agent';
import { generateEmbeddingAgent } from './embedding_agent';
import { storeEmbeddingAgent } from './pinecone_agent';

export async function ingestCSVOrchestrator(filePath: string, options?: IngestionOptions) {
  // 1. Parse CSV
  const rows = await parseCSVAgent(filePath);
  
  // 2. Process each row
  for (const row of rows) {
    // 3. Transform data
    const transformed = await transformStartupDataAgent(row);
    
    // 4. Insert into Supabase
    const startupId = await insertStartupAgent(supabase, transformed);
    
    // 5. Generate embedding
    const embedding = await generateEmbeddingAgent(transformed.description);
    
    // 6. Store in Pinecone
    await storeEmbeddingAgent(startupId, embedding, transformed);
  }
}
```

### Step 4: Make Agents Configurable

Add configuration and error handling:

```typescript
// agents/ingestion_orchestrator.ts
interface IngestionOptions {
  batchSize?: number;
  skipExisting?: boolean;
  generateEmbeddings?: boolean;
  storeInPinecone?: boolean;
  onProgress?: (current: number, total: number) => void;
}

export async function ingestCSVOrchestrator(
  filePath: string,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const {
    batchSize = 10,
    skipExisting = true,
    generateEmbeddings = true,
    storeInPinecone = true,
    onProgress
  } = options;
  
  // Implementation with options
}
```

## Agent Architecture Patterns

### Pattern 1: Single Responsibility Agents

Each agent does one thing well:

```typescript
// agents/web_search_agent.ts
export async function searchWebAgent(query: string): Promise<SearchResult[]>

// agents/data_extraction_agent.ts
export function extractFounderInfoAgent(results: SearchResult[]): FounderInfo

// agents/enrichment_agent.ts
export async function enrichStartupAgent(startup: Startup): Promise<EnrichedData>
```

### Pattern 2: Agent Composition

Agents can call other agents:

```typescript
// agents/enrichment_agent.ts
export async function enrichStartupAgent(startup: Startup): Promise<EnrichedData> {
  // Use web search agent
  const searchResults = await searchWebAgent(`${startup.name} founder`);
  
  // Use extraction agent
  const founderInfo = extractFounderInfoAgent(searchResults);
  
  // Combine results
  return {
    ...startup,
    ...founderInfo
  };
}
```

### Pattern 3: Agent Orchestration

Orchestrator agents coordinate multiple agents:

```typescript
// agents/enrichment_orchestrator.ts
export async function enrichStartupsOrchestrator(limit: number = 10) {
  // 1. Get startups needing enrichment
  const startups = await getStartupsNeedingEnrichmentAgent(limit);
  
  // 2. Enrich each startup
  for (const startup of startups) {
    await enrichStartupAgent(startup);
  }
}
```

## Migration Example: CSV Ingestion Script → Agents

### Before (Script)

```typescript
// scripts/ingest-csv-supabase.ts
async function ingestCSV() {
  const rows = parseCSV(csvPath);
  
  for (const row of rows) {
    const data = transformRow(row);
    await supabase.from('startups').insert(data);
    const embedding = await generateEmbedding(data.description);
    await pineconeIndex.upsert({ id, values: embedding });
  }
}
```

### After (Agents)

```typescript
// agents/csv_ingestion_agent.ts
import { parseCSVAgent } from './csv_parser_agent';
import { transformStartupDataAgent } from './data_transformer_agent';
import { insertStartupAgent } from './supabase_agent';
import { generateEmbeddingAgent } from './embedding_agent';
import { storeEmbeddingAgent } from './pinecone_agent';

export async function ingestCSVAgent(filePath: string, options?: IngestionOptions) {
  const rows = await parseCSVAgent(filePath);
  
  for (const row of rows) {
    const data = await transformStartupDataAgent(row);
    const startupId = await insertStartupAgent(supabase, data);
    
    if (options?.generateEmbeddings) {
      const embedding = await generateEmbeddingAgent(data.description);
      await storeEmbeddingAgent(startupId, embedding, data);
    }
  }
}
```

## Directory Structure

Organize agents in a dedicated directory:

```
agents/
├── csv_parser_agent.ts          # CSV parsing
├── data_transformer_agent.ts     # Data transformation
├── supabase_agent.ts             # Supabase operations
├── embedding_agent.ts            # Embedding generation
├── pinecone_agent.ts             # Pinecone operations
├── web_search_agent.ts           # Web search (already exists)
├── enrichment_agent.ts           # Data enrichment
├── ingestion_orchestrator.ts     # Main ingestion orchestrator
└── enrichment_orchestrator.ts    # Enrichment orchestrator
```

## Benefits of Agent Architecture

1. **Reusability**: Agents can be used in multiple contexts
2. **Testability**: Each agent can be tested independently
3. **Maintainability**: Changes are isolated to specific agents
4. **Composability**: Agents can be combined in different ways
5. **Orchestration**: Can be scheduled, queued, or triggered by events
6. **Error Handling**: Better error isolation and recovery

## Migration Checklist

- [ ] Identify distinct responsibilities in scripts
- [ ] Extract reusable functions into agent modules
- [ ] Create orchestrator agents for workflows
- [ ] Add configuration options to agents
- [ ] Add error handling and retry logic
- [ ] Add logging and monitoring
- [ ] Update package.json scripts to use agents
- [ ] Write tests for individual agents
- [ ] Document agent interfaces and usage

## Example: Refactoring ingest-csv-supabase.ts

### Step 1: Create Agent Modules

```typescript
// agents/csv_parser_agent.ts
export async function parseCSVAgent(filePath: string): Promise<CSVRow[]>

// agents/embedding_agent.ts
export async function generateEmbeddingAgent(text: string): Promise<number[]>

// agents/supabase_agent.ts
export async function insertStartupAgent(
  supabase: SupabaseClient,
  data: StartupData
): Promise<string>

// agents/pinecone_agent.ts
export async function storeEmbeddingAgent(
  id: string,
  embedding: number[],
  metadata: Record<string, any>
): Promise<void>
```

### Step 2: Create Orchestrator

```typescript
// agents/ingestion_orchestrator.ts
export async function ingestCSVOrchestrator(
  filePath: string,
  options?: IngestionOptions
): Promise<IngestionResult>
```

### Step 3: Update Script Entry Point

```typescript
// scripts/ingest-csv-supabase.ts (simplified)
import { ingestCSVOrchestrator } from '../agents/ingestion_orchestrator';

if (require.main === module) {
  const csvPath = join(process.cwd(), 'yc_companies', 'FINAL_DATASET - FINAL_DATASET.csv (1).csv');
  ingestCSVOrchestrator(csvPath)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Ingestion failed:', error);
      process.exit(1);
    });
}
```

## Next Steps

1. **Start Small**: Migrate one script at a time
2. **Identify Patterns**: Look for repeated logic across scripts
3. **Create Base Agents**: Extract common functionality
4. **Build Orchestrators**: Create workflow orchestrators
5. **Add Monitoring**: Track agent execution and performance
6. **Document**: Document agent interfaces and usage patterns

## Related Files

- `yc_companies/web_search_agent.ts` - Example of a well-structured agent
- `yc_companies/enrich_startup_data.ts` - Example of agent orchestration
- `ENRICHMENT_WORKFLOW.md` - Workflow documentation

