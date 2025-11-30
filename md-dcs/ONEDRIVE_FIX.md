# Fixing EPERM Errors with OneDrive

## The Problem

You're getting `EPERM: operation not permitted` errors because OneDrive is trying to sync the `.next` directory while Next.js is trying to write/delete files in it. This causes file locks.

## Permanent Solutions (Choose One)

### Option 1: Exclude `.next` from OneDrive Sync (Recommended)

1. **Right-click the OneDrive icon** in your system tray (bottom-right)
2. Click **Settings** → **Sync and backup** → **Advanced settings**
3. Look for **"Choose folders"** or **"Exclude folders"** option
4. Add `.next` to the exclusion list

**Note:** The exact steps may vary depending on your OneDrive version. If you can't find this option, use Option 2 or 3.

### Option 2: Move Project Outside OneDrive

Move your project to a location that's not synced by OneDrive:

```powershell
# Example: Move to C:\Projects
Move-Item "C:\Users\aaron\OneDrive\Documents\Projects\ColdStart" "C:\Projects\ColdStart"
```

Then update any shortcuts or workspace paths.

### Option 3: Use OneDrive's "Files On-Demand" Feature

1. Right-click OneDrive icon → **Settings**
2. Go to **Sync and backup** → **Advanced settings**
3. Enable **"Files On-Demand"**
4. Right-click the `.next` folder → **Free up space** (this makes it online-only)

This prevents OneDrive from locking the files locally.

## Temporary Workaround

If you need a quick fix right now:

1. **Pause OneDrive sync temporarily:**
   - Right-click OneDrive icon → **Pause syncing** → **2 hours**
   - Run your dev server
   - Resume syncing when done

2. **Use the cleanup script:**
   ```bash
   npm run clean
   ```

## About the Source Map Warnings

The "Invalid source map" warnings are **harmless**. They come from Next.js internal files and don't affect your app's functionality. You can safely ignore them.

## Why This Happens

OneDrive continuously monitors files in synced folders. When Next.js tries to:
- Write new files during build
- Delete old files during rebuild
- Update files during hot reload

OneDrive may have a lock on those files, causing the EPERM error.

## Best Practice

**For development projects, it's recommended to keep them outside OneDrive** or exclude build directories (like `.next`, `node_modules`, `dist`, etc.) from sync. These directories:
- Change frequently
- Are large
- Can be regenerated
- Don't need to be backed up

