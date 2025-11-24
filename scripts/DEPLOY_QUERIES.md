# How to Deploy Queries to HelixDB

## The Problem
Your queries in `db/queries.hx` aren't being loaded into HelixDB. The errors show:
- `AddFounder` query not found
- `AddFundingRound` query not found
- Other queries may also be missing

## Solution: Deploy Queries

Based on HelixDB documentation, you need to **deploy** your queries to the running HelixDB instance.

### Step 1: Check if `AddStartup` is working

First, check if at least some queries are loaded. Look at your ingestion script output - are startups being created successfully?

### Step 2: Deploy Queries

Try running this command to deploy your queries:

```bash
helix push dev
```

This compiles and deploys queries from `db/queries.hx` to your local HelixDB instance.

### Step 3: If that doesn't work, try:

```bash
# Deploy to local development
helix deploy --local

# Or if you have a specific environment
helix push local
```

### Step 4: Restart HelixDB

After deploying, restart your HelixDB container:

```bash
# Find container
docker ps

# Restart it
docker restart <container_name>
```

### Alternative: Check HelixDB Volume Mounts

If queries still don't load, make sure your Docker container has the `db/` directory mounted:

1. **Check how your container was started:**
   ```bash
   docker inspect <container_name> | grep -A 10 Mounts
   ```

2. **If the db/ directory isn't mounted**, you may need to:
   - Stop the container
   - Restart it with the volume mounted:
   ```bash
   docker run -v $(pwd)/db:/app/db ... <other_args>
   ```

### Verify Queries Are Deployed

After deploying, run your ingestion script:
```bash
npm run ingest
```

The script will check if queries are available and show warnings for any that are missing.

