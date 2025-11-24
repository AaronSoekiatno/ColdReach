# How to Restart HelixDB Docker Container

## Method 1: Find and Restart Container

1. **Find the running HelixDB container:**
   ```bash
   docker ps
   ```
   Look for a container name containing "helix" or "coldstart"

2. **Restart the container:**
   ```bash
   docker restart <container_name_or_id>
   ```

## Method 2: Using Helix CLI

If HelixDB was started with `helix dev`:
```bash
# Stop the current process (Ctrl+C if running)
# Then restart:
helix dev
```

## Method 3: Stop and Start Fresh

```bash
# Find container
docker ps

# Stop it
docker stop <container_name_or_id>

# Start it again
docker start <container_name_or_id>
```

## Verify Queries Are Loaded

After restarting, run the ingestion script:
```bash
npm run ingest
```

The script will check if queries are deployed and show a warning if they're not.

