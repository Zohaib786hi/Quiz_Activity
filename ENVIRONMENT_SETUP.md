# Environment Variables Setup Guide

## Required Environment Variables

### For Discord Activity (Client-side)
These need to be set in your Discord Application settings:

1. **VITE_DISCORD_CLIENT_ID**
   - Your Discord Application's Client ID
   - Found in Discord Developer Portal → Your App → OAuth2 → General
   - Example: `1234567890123456789`

### For Server (Backend)
These need to be set in your Render deployment environment variables:

1. **DISCORD_CLIENT_ID** (or VITE_DISCORD_CLIENT_ID)
   - Same as above - your Discord Application's Client ID

2. **CLIENT_SECRET**
   - Your Discord Application's Client Secret
   - Found in Discord Developer Portal → Your App → OAuth2 → General
   - Example: `abc123xyz789secretstring`

3. **PORT** (Optional)
   - Server port (defaults to 3001)
   - Render will set this automatically

## How to Set Environment Variables

### For Render Deployment:
1. Go to your Render dashboard
2. Select your web service
3. Go to "Environment" tab
4. Add the following variables:
   ```
   DISCORD_CLIENT_ID=your_client_id_here
   CLIENT_SECRET=your_client_secret_here
   ```

### For Local Development:
Create a `.env` file in the server directory:
```
DISCORD_CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
PORT=3001
```

## Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select existing one
3. Go to "OAuth2" → "General"
4. Copy the Client ID and Client Secret
5. Set the redirect URI to: `https://quiz-activity.onrender.com`
6. Go to "Rich Presence" → "Art Assets"
7. Upload your activity images
8. Go to "Activities" → "Create Activity"
9. Use the `activity.json` configuration

## Troubleshooting

### If cards don't load:
- The card images are hosted on external servers
- The app will show a fallback display if images fail to load
- This is normal behavior and doesn't affect gameplay

### If multiplayer doesn't work:
- Check that your Discord Application is properly configured
- Ensure environment variables are set correctly
- Check the browser console for error messages
- The app will fall back to local mode if multiplayer fails

### If the activity doesn't appear in Discord:
- Make sure your Discord Application is approved for Activities
- Check that the `activity.json` is properly configured
- Ensure the iframe URL points to your deployed app
