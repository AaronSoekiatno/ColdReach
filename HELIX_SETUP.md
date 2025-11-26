# Helix Database Setup

Helix database is **not** managed by Docker Compose. It runs separately using the Helix CLI.

## Quick Start

### 1. Install Helix CLI

If you haven't already, install the Helix CLI:

```bash
# Follow instructions at https://helix.dev/docs/getting-started
```

### 2. Start Helix Database

In a **separate terminal**, run:

```bash
helix dev
```

This will:
- Start Helix database on port 6969
- Manage its own Docker container automatically
- Watch for changes in your `db/` directory

### 3. Deploy Your Queries

After Helix is running, deploy your queries:

```bash
helix push dev
```

Or:

```bash
helix deploy --local
```

### 4. Start Your Next.js App

Now in your main terminal, start the web app:

```bash
# Development mode (with hot reload)
docker compose --profile dev up

# Or production mode
docker compose --profile production up
```

## Connection Details

- **Helix URL**: `http://localhost:6969` (when running on host)
- **From Docker containers**: `http://host.docker.internal:6969` (Windows/Mac) or `http://172.17.0.1:6969` (Linux)

The docker-compose.yml is configured to use `host.docker.internal` which works on Windows, Mac, and WSL.

## Troubleshooting

### "Cannot connect to Helix"

1. **Make sure Helix is running:**
   ```bash
   # Check if Helix is running
   curl http://localhost:6969
   ```

2. **If using Linux/WSL, you might need to use the host IP:**
   ```bash
   # Find your host IP
   ip addr show docker0 | grep inet
   
   # Or use this in docker-compose.yml:
   # HELIX_URL=http://172.17.0.1:6969
   ```

3. **Check Helix logs:**
   ```bash
   # If Helix is running in a container
   docker ps
   docker logs <helix-container-name>
   ```

### "Queries not found"

Deploy your queries:
```bash
helix push dev
```

Then restart Helix if needed.

## Development Workflow

1. **Terminal 1**: Run Helix
   ```bash
   helix dev
   ```

2. **Terminal 2**: Run Next.js (with hot reload)
   ```bash
   docker compose --profile dev up
   ```

3. **Edit your code** - changes will hot reload automatically!

## Stopping

- **Stop Helix**: Press `Ctrl+C` in the terminal running `helix dev`
- **Stop Next.js**: Run `docker compose down` in the project directory

