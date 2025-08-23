# Age of Empires III Discord Quiz Activity

A multiplayer trivia game for Discord Activities featuring Age of Empires III questions. Players compete in real-time with synchronized questions and a daily leaderboard that resets each day.

## Features

- 🎮 **Multiplayer Quiz Game**: Real-time synchronized questions for all players
- 🏆 **Daily Leaderboard**: Scores reset daily at midnight UTC
- 🎯 **Multiple Game Modes**: Standard trivia and card-based questions
- 🎨 **Rich UI**: Custom Age of Empires III themed interface
- 🔊 **Audio**: Background music and sound effects
- 🔄 **Real-time Sync**: Questions and scores synchronized across all players
- 📊 **Score Tracking**: Time-based scoring with bonus points for quick answers

## Prerequisites

- Node.js 18+ 
- Cloudflare account with tunnel access
- Discord Application with Activity permissions

## Setup Instructions

### 1. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "OAuth2" → "General"
4. Add redirect URI: `https://your-tunnel-url.trycloudflare.com`
5. Copy your Client ID and Client Secret
6. Go to "Activities" and create a new Activity
7. Upload the `activity.json` file

### 2. Cloudflare Tunnel Setup

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Run: `cloudflared tunnel create discord-quiz-activity`
3. Copy the tunnel ID and update `cloudflare-tunnel.yml`
4. Run: `cloudflared tunnel route dns discord-quiz-activity your-subdomain.trycloudflare.com`

### 3. Environment Configuration

1. Copy `.env.example` to `.env`
2. Update with your Discord credentials:
```env
VITE_DISCORD_CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
PORT=3001
```

### 4. Installation & Deployment

#### Option A: Using the deployment script
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Option B: Manual deployment
```bash
# Install client dependencies
cd client
npm install
npm run build
cd ..

# Install server dependencies
cd server
npm install
cd ..

# Start server
cd server
node server.js
```

In another terminal:
```bash
cloudflared tunnel --config cloudflare-tunnel.yml run
```

### 5. Update URLs

After getting your Cloudflare tunnel URL, update these files:
- `activity.json` - Update `iframe_url` and `redirect_url`
- `client/src/multiplayer-service.js` - Update server URL
- `server/server.js` - Update redirect URI

## Project Structure

```
discord-quiz-activity/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main game component
│   │   ├── discord-integration.js  # Discord SDK integration
│   │   ├── multiplayer-service.js  # Socket.IO multiplayer
│   │   ├── questions.json # Trivia questions
│   │   └── hc_cards.json  # Card-based questions
│   └── package.json
├── server/                 # Node.js backend
│   ├── server.js          # Express + Socket.IO server
│   ├── questions.json     # Server-side questions
│   └── package.json
├── activity.json          # Discord Activity manifest
├── cloudflare-tunnel.yml  # Cloudflare tunnel config
├── deploy.sh             # Deployment script
└── README.md
```

## Game Modes

### Standard Trivia
- Multiple choice questions about Age of Empires III
- 15-second timer per question
- Points awarded based on speed and accuracy

### Card Mode
- Players guess the name of Age of Empires III cards
- Text input with real-time feedback
- Same scoring system as trivia

## Scoring System

- **Base Points**: Up to 150 points per correct answer
- **Time Bonus**: Faster answers get more points
- **Daily Tracking**: Scores reset at midnight UTC
- **Leaderboard**: Top 100 players tracked globally

## API Endpoints

- `GET /api/leaderboard` - Get daily leaderboard
- `GET /api/user/:userId/score` - Get user's daily score
- `POST /api/token` - Discord OAuth token exchange
- `GET /api/me` - Get current user info

## Adding Questions

### Trivia Questions
Edit `server/questions.json`:
```json
{
  "question": "Your question here?",
  "options": [
    "A) Option 1",
    "B) Option 2", 
    "C) Option 3",
    "D) Option 4"
  ],
  "answer": "A"
}
```

### Card Questions
Edit `client/src/hc_cards.json`:
```json
{
  "Card Name": "https://image-url.com/card.png"
}
```

## Troubleshooting

### Common Issues

1. **Discord SDK not loading**
   - Ensure you're running in Discord's embedded app environment
   - Check that the activity is properly configured

2. **Connection issues**
   - Verify Cloudflare tunnel is running
   - Check server logs for errors
   - Ensure all URLs are updated correctly

3. **Authentication errors**
   - Verify Discord credentials in `.env`
   - Check redirect URI matches exactly

### Logs

Server logs will show:
- Player connections/disconnections
- Daily score resets
- Question starts/completions
- Error messages

## Development

### Local Development
```bash
# Terminal 1: Start server
cd server
npm install
node server.js

# Terminal 2: Start client dev server
cd client
npm install
npm run dev
```

### Testing
The app includes a local mode that works without Discord integration for testing.

## License

This project is for educational purposes. Age of Empires III is a trademark of Microsoft Corporation.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Verify all configuration steps are completed
4. Ensure Discord Activity permissions are set correctly
