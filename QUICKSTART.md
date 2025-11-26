# ColdStart Quick Start Guide

Get ColdStart running in 5 minutes using Docker.

## Prerequisites

- Docker Desktop installed (Windows/Mac) or Docker Engine (Linux)
- Google Gemini API key ([Get one here](https://ai.google.dev/))

## 1️⃣ Clone & Configure

```bash
# Clone the repository
git clone https://github.com/yourusername/ColdStart.git
cd ColdStart

# Create environment file
# Use .env.local (preferred - it's gitignored) or .env
cp .env.example .env.local

# Edit .env.local and add your Gemini API key
# Windows:
notepad .env.local

# Mac/Linux:
nano .env.local
```

Update this line in `.env.local`:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

> **Note:** `.env.local` is preferred because it's automatically gitignored. Docker Compose will use `.env.local` if it exists, otherwise falls back to `.env`.

## 2️⃣ Start Everything

**Important:** Helix runs separately from Docker Compose. You need two terminals:

**Terminal 1 - Start Helix:**
```bash
helix dev
```

**Terminal 2 - Start the web app:**
```bash
# Development mode (with hot reload)
docker compose --profile dev up

# Or production mode
docker compose --profile production up
```

Wait for:
```
✓ Helix DB started on port 6969 (in Terminal 1)
coldstart-web-dev | ✓ Ready on http://localhost:3000 (in Terminal 2)
```

> **Note:** See [HELIX_SETUP.md](HELIX_SETUP.md) for detailed Helix setup instructions.

## 3️⃣ Access the App

Open your browser to: **http://localhost:3000**

You should see the resume upload interface.

## 4️⃣ Test Resume Upload

1. Drag and drop a PDF or DOCX resume
2. Click "Upload Resume"
3. Wait for AI processing
4. View extracted candidate information

## 5️⃣ (Optional) Load Sample Data

```bash
# In a new terminal, run the CSV ingestion script
docker exec -it coldstart-web npm run ingest
```

This loads Y Combinator startup data into Helix DB.

---

## Common Issues

### "Error: Cannot connect to Helix"

**Solution**: Wait 30 seconds for Helix to fully start, then refresh.

### "Port 3000 already in use"

**Solution**: Change the port in `docker-compose.yml`:
```yaml
web:
  ports:
    - "3001:3000"  # Use port 3001 instead
```

### "docker-compose: command not found" (WSL)

**Solution**: Use `docker compose` (space, not hyphen). Docker Compose V2 is built into Docker Desktop and uses the space syntax:
```bash
# Use this instead:
docker compose up

# Not this:
docker-compose up
```

### "env file .env not found"

**Solution**: Docker Compose looks for `.env.local` first, then `.env`. Create one of these files:
```bash
# Option 1: Create .env.local (recommended - gitignored)
cp .env.example .env.local
nano .env.local  # Add your GEMINI_API_KEY

# Option 2: Create .env
cp .env.example .env
nano .env  # Add your GEMINI_API_KEY
```

### "GEMINI_API_KEY not set"

**Solution**: Make sure you created `.env.local` (or `.env`) with your API key. Both are supported, but `.env.local` is preferred.

---

## Development Mode (Hot Reload)

For active development with code changes auto-reloading:

```bash
# Stop the production containers
docker compose down

# Start in development mode (includes Helix + web-dev)
docker compose --profile dev up
```

Now edit files in `app/`, `lib/`, or `db/` and see changes instantly - **no server restart needed!**

> 💡 **Tip:** See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development setup and troubleshooting.

---

## Stopping the App

```bash
# Stop containers but keep data
docker compose down

# Stop and remove all data (CAUTION)
docker compose down -v
```

---

## Next Steps

- **Full deployment guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Architecture overview**: See [README.md](README.md)
- **Troubleshooting**: See [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `docker compose up` | Start production app |
| `docker compose --profile dev up` | Start dev mode (hot reload) |
| `docker compose down` | Stop app |
| `docker compose logs -f` | View live logs |
| `docker compose restart helix` | Restart database |
| `docker exec -it coldstart-web npm run ingest` | Load sample data |
| `docker stats` | View resource usage |

> **Note for WSL users:** Use `docker compose` (space) not `docker-compose` (hyphen). Docker Compose V2 is built into Docker Desktop.
