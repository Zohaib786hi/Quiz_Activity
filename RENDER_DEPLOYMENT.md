# Render Deployment Guide

## Prerequisites
1. Render account
2. Discord Application with OAuth2 configured

## Deployment Steps

### 1. Connect Your Repository
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository containing this project

### 2. Configure the Web Service

**Name:** `quiz-activity` (or your preferred name)

**Environment:** `Node`

**Build Command:** 
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Port:** `10000`

### 3. Environment Variables
Add these environment variables in the Render dashboard:

| Key | Value | Description |
|-----|-------|-------------|
| `VITE_DISCORD_CLIENT_ID` | `your_discord_client_id` | Your Discord application client ID |
| `CLIENT_SECRET` | `your_discord_client_secret` | Your Discord application client secret |
| `PORT` | `10000` | Port for the server (Render will override this) |
| `NODE_ENV` | `production` | Environment mode |

### 4. Discord Application Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to "OAuth2" → "General"
4. Add redirect URI: `https://your-render-app-name.onrender.com`
5. Copy the Client ID and Client Secret to use in Render environment variables

### 5. Deploy
1. Click "Create Web Service"
2. Render will automatically build and deploy your application
3. Wait for the build to complete (this may take 5-10 minutes on first deploy)

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check that all dependencies are in the root `package.json`
   - Ensure Node.js version is 18+ (specified in package.json)

2. **Client Not Found Error**
   - The build process should automatically create the client build
   - Check the build logs for any errors in the client build step

3. **Socket.IO Connection Issues**
   - Ensure the client is connecting to the correct Render URL
   - Check that the server is properly serving the built client files

4. **Discord Authentication Issues**
   - Verify the redirect URI matches exactly in Discord Developer Portal
   - Check that environment variables are set correctly in Render

### Build Process
The deployment uses these steps:
1. `npm install` - Installs all dependencies
2. `npm run build` - Builds the React client
3. `npm start` - Starts the Express server

### File Structure After Build
```
/
├── node_modules/
├── client/
│   └── dist/          # Built React app
├── server/
│   └── server.js      # Express server
└── package.json
```

## Monitoring
- Check the "Logs" tab in Render dashboard for real-time logs
- Monitor the "Metrics" tab for performance and error rates
- Set up alerts for failed deployments or high error rates
