import { io } from 'socket.io-client';
import discordIntegration from './discord-integration.js';

class MultiplayerService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.roomId = null;
    this.currentUser = null;
    this.players = [];
    this.scores = {};
    this.currentQuestion = null;
    this.selections = {};
    this.timeLeft = 15;
    this.showResult = false;
    
    // Event callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onQuestionStart = null;
    this.onPlayerSelect = null;
    this.onShowResult = null;
    this.onRoomStateUpdate = null;
    this.onError = null;
  }

  async initialize() {
    try {
      // Initialize Discord integration first
      const discordInitialized = await discordIntegration.initialize();
      if (!discordInitialized) {
        console.warn('Discord SDK not available, running in local mode');
        return false;
      }

      this.currentUser = await discordIntegration.getCurrentUser();
      this.roomId = await discordIntegration.getRoomId();

      // Connect to server
      await this.connectToServer();
      return true;
    } catch (error) {
      console.error('Failed to initialize multiplayer service:', error);
      return false;
    }
  }

  async connectToServer() {
    try {
      // Get Discord token for authentication
      const token = await this.getDiscordToken();
      
      this.socket = io('https://your-cloudflare-tunnel-url.trycloudflare.com', {
        auth: {
          token: token,
          roomId: this.roomId
        },
        transports: ['websocket', 'polling']
      });

      this.setupEventListeners();
      
      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          this.isConnected = true;
          console.log('Connected to server');
          if (this.onConnect) this.onConnect();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          if (this.onError) this.onError(error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw error;
    }
  }

  async getDiscordToken() {
    try {
      // This would typically come from Discord's OAuth flow
      // For now, we'll use a placeholder - in production this should be properly implemented
      const sdk = discordIntegration.sdk;
      if (sdk && sdk.commands.getAccessToken) {
        return await sdk.commands.getAccessToken();
      }
      throw new Error('No access token available');
    } catch (error) {
      console.error('Failed to get Discord token:', error);
      throw error;
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Disconnected from server');
      if (this.onDisconnect) this.onDisconnect();
    });

    this.socket.on('you_joined', (data) => {
      console.log('You joined:', data);
    });

    this.socket.on('room_state', (data) => {
      console.log('Room state update:', data);
      this.players = data.players || [];
      this.scores = data.scores || {};
      if (this.onRoomStateUpdate) this.onRoomStateUpdate(data);
    });

    this.socket.on('question_started', (data) => {
      console.log('Question started:', data);
      this.currentQuestion = data.question;
      this.selections = {};
      this.showResult = false;
      this.timeLeft = data.maxTime || 15;
      if (this.onQuestionStart) this.onQuestionStart(data);
    });

    this.socket.on('player_selected', (data) => {
      console.log('Player selected:', data);
      this.selections[data.playerId] = data.optionIndex;
      if (this.onPlayerSelect) this.onPlayerSelect(data);
    });

    this.socket.on('show_result', (data) => {
      console.log('Show result:', data);
      this.showResult = true;
      this.scores = data.scores || {};
      if (this.onShowResult) this.onShowResult(data);
    });

    this.socket.on('error', (error) => {
      console.error('Server error:', error);
      if (this.onError) this.onError(error);
    });
  }

  startGame() {
    if (!this.socket || !this.isConnected) {
      console.error('Not connected to server');
      return;
    }
    this.socket.emit('start_game', { roomId: this.roomId });
  }

  selectOption(optionIndex) {
    if (!this.socket || !this.isConnected) {
      console.error('Not connected to server');
      return;
    }
    this.socket.emit('select_option', { 
      roomId: this.roomId, 
      optionIndex: optionIndex 
    });
  }

  submitCardAnswer(answer) {
    if (!this.socket || !this.isConnected) {
      console.error('Not connected to server');
      return;
    }
    this.socket.emit('submit_card_answer', { 
      roomId: this.roomId, 
      answer: answer 
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Getter methods for current state
  getCurrentState() {
    return {
      isConnected: this.isConnected,
      roomId: this.roomId,
      currentUser: this.currentUser,
      players: this.players,
      scores: this.scores,
      currentQuestion: this.currentQuestion,
      selections: this.selections,
      timeLeft: this.timeLeft,
      showResult: this.showResult
    };
  }
}

// Create singleton instance
const multiplayerService = new MultiplayerService();
export default multiplayerService;
