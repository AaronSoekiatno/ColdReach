# Development Guide - Hot Reload Setup

## The Problem

If you're having to restart the Linux server every time you make code changes, you're likely running the app in **production mode** instead of **development mode**. Production mode doesn't watch for file changes.

## The Solution

Use the **development profile** in Docker Compose, which enables hot reload and file watching.

## Quick Start (Development Mode)

### 1. Stop any running containers
```bash
docker compose down
```

### 2. Start in development mode
```bash
docker compose --profile dev up
```

> **WSL Note:** Use `docker compose` (space) not `docker-compose` (hyphen). Docker Compose V2 is built into Docker Desktop.

This will:
- Start Helix database
- Start Next.js in development mode with hot reload
- Mount your source code as a volume so changes are detected instantly
- Enable file watching with polling (works on Linux/WSL)

### 3. Start coding!

Now when you edit files in `app/`, `lib/`, or any other directory, Next.js will automatically:
- Detect the changes
- Recompile only what changed
- Refresh your browser (if you have it open)

**No more server restarts needed!** 🎉

## Development vs Production

### Development Mode (Hot Reload)
```bash
docker compose --profile dev up
```
- ✅ Hot reload enabled
- ✅ Fast refresh
- ✅ Source code mounted as volume
- ✅ File watching with polling
- ⚠️ Slower (not optimized)

### Production Mode (No Hot Reload)
```bash
docker compose --profile production up
# or just
docker compose up
```
- ❌ No hot reload
- ✅ Optimized build
- ✅ Faster runtime
- ❌ Must rebuild to see changes

## Troubleshooting

### Changes still not detected?

1. **Check you're using dev profile:**
   ```bash
   docker compose ps
   ```
   You should see `coldstart-web-dev` (not `coldstart-web`)

2. **Check file permissions:**
   ```bash
   ls -la app/
   ```
   Make sure files are readable

3. **Increase inotify limits (Linux/WSL):**
   ```bash
   # Check current limits
   cat /proc/sys/fs/inotify/max_user_watches
   
   # Increase if needed (temporary)
   sudo sysctl fs.inotify.max_user_watches=524288
   
   # Make permanent (add to /etc/sysctl.conf)
   echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
   ```

4. **Restart the dev container:**
   ```bash
   docker compose --profile dev restart web-dev
   ```

### Still having issues?

The dev container uses polling mode (`WATCHPACK_POLLING=true`) which should work even if inotify is limited. If changes still aren't detected:

1. Check the logs:
   ```bash
   docker compose --profile dev logs -f web-dev
   ```

2. Try rebuilding the dev container:
   ```bash
   docker compose --profile dev build --no-cache web-dev
   docker compose --profile dev up web-dev
   ```

## Alternative: Run Locally (No Docker)

If Docker is causing issues, you can run Next.js directly:

```bash
# Install dependencies
npm install

# Make sure Helix is running (in Docker or locally)
# Then start Next.js dev server
npm run dev
```

This will give you the fastest hot reload experience.

## Summary

**For active development:** Always use `docker compose --profile dev up`

**For production/testing:** Use `docker compose --profile production up` or `docker compose up`

