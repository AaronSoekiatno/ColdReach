# Gmail OAuth Setup Guide

This guide explains how to set up Gmail OAuth integration to enable users to send emails directly from their Gmail accounts.

## Prerequisites

1. Google Cloud Console project (can use the same one as Supabase Google OAuth)
2. Gmail API enabled
3. OAuth 2.0 credentials configured

## Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Enable the **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Web application**
   - Name: "ColdStart Gmail API" (or any name)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/gmail/callback` (for development)
     - `https://yourdomain.com/api/auth/gmail/callback` (for production)

5. Copy your credentials:
   - **Client ID**
   - **Client Secret**

## Step 2: Environment Variables

Add these to your `.env.local` file:

```env
# Google OAuth for Gmail API (separate from Supabase OAuth)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Your app URL (used for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# For production: NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Step 3: Run Database Migration

Run the SQL migration to create the `user_email_connections` table:

1. Go to your Supabase dashboard
2. Navigate to "SQL Editor"
3. Run the migration file: `supabase/migrations/003_create_user_email_connections.sql`

Or run it via Supabase CLI:
```bash
supabase db push
```

## Step 4: OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Configure the consent screen:
   - User Type: External (or Internal if using Google Workspace)
   - App name: "ColdStart"
   - User support email: Your email
   - Developer contact: Your email
3. Add scopes:
   - Click "Add or Remove Scopes"
   - Search for and add: `https://www.googleapis.com/auth/gmail.send`
   - Save

## Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Sign in to your app

3. Add the `ConnectGmailButton` component to your UI:
   ```tsx
   import { ConnectGmailButton } from '@/components/ConnectGmailButton';
   
   <ConnectGmailButton />
   ```

4. Click "Connect Gmail" and authorize the app

5. Try sending an email using the `SendEmailButton` component

## Usage

### Connect Gmail Button

Add this component anywhere in your app to let users connect their Gmail:

```tsx
import { ConnectGmailButton } from '@/components/ConnectGmailButton';

<ConnectGmailButton />
```

### Send Email Button

Use this component to send emails to startup founders:

```tsx
import { SendEmailButton } from '@/components/SendEmailButton';

<SendEmailButton
  startupId="startup-id-here"
  matchScore={0.85}
  founderEmail="founder@startup.com"
  onSent={() => console.log('Email sent!')}
/>
```

### Check Gmail Connection Status

```typescript
const response = await fetch('/api/auth/gmail/status', {
  credentials: 'include',
});
const { connected, expired } = await response.json();
```

## API Endpoints

### `GET /api/auth/gmail/connect`
Initiates Gmail OAuth flow. Redirects user to Google consent screen.

### `GET /api/auth/gmail/callback`
OAuth callback handler. Stores tokens in database.

### `GET /api/auth/gmail/status`
Check if user's Gmail is connected and if token is expired.

### `POST /api/send-email`
Sends an email via Gmail API.

**Request body:**
```json
{
  "startupId": "startup-id",
  "matchScore": 0.85
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

## Troubleshooting

### "Gmail not connected" error
- User needs to connect Gmail first using `ConnectGmailButton`
- Check that OAuth flow completed successfully

### "Token expired" error
- Tokens are automatically refreshed, but if refresh fails, user needs to reconnect
- Check that refresh token is stored in database

### "Insufficient permissions" error
- User may have revoked permissions
- Reconnect Gmail to grant permissions again

### OAuth redirect URI mismatch
- Ensure redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/api/auth/gmail/callback`
- Check `NEXT_PUBLIC_APP_URL` environment variable

## Security Notes

- Access tokens are stored encrypted in Supabase
- Row Level Security (RLS) ensures users can only access their own tokens
- Tokens are automatically refreshed when expired
- Only `gmail.send` scope is requested (minimal permissions)

## Production Checklist

- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Add production redirect URI to Google Cloud Console
- [ ] Verify OAuth consent screen is published (if external users)
- [ ] Test email sending in production
- [ ] Monitor token refresh errors
- [ ] Set up error logging for failed email sends

