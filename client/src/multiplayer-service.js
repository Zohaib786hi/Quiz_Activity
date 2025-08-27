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
      console.log('Initializing multiplayer service...');
      
      // Initialize Discord integration first
      const discordInitialized = await discordIntegration.initialize();
      if (!discordInitialized) {
        console.warn('Discord SDK not available, running in local mode');
        return false;
      }

      this.currentUser = await discordIntegration.getCurrentUser();
      this.roomId = await discordIntegration.getRoomId();
      
      console.log('Discord integration successful, user:', this.currentUser);
      console.log('Room ID:', this.roomId);

      // Connect to server
      try {
        await this.connectToServer();
        return true;
      } catch (connectionError) {
        console.error('Failed to connect to server:', connectionError);
        console.log('Will run in local mode due to server connection failure');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize multiplayer service:', error);
      return false;
    }
  }

  async connectToServer() {
    try {
      console.log('Attempting to connect to server...');
      
      // Get Discord token for authentication
      const token = await this.getDiscordToken();
      console.log('Discord token obtained:', token ? 'Yes' : 'No');
      
      this.socket = io('https://quiz-activity.onrender.com', {
        auth: {
          token: token,
          roomId: this.roomId
        },
        transports: ['websocket', 'polling'],
        timeout: 10000, // 10 second timeout
        forceNew: true
      });

      this.setupEventListeners();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('Connection timeout');
          reject(new Error('Connection timeout'));
        }, 15000); // 15 second timeout

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          console.log('Connected to server successfully');
          if (this.onConnect) this.onConnect();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('Connection error:', error);
          this.isConnected = false;
          if (this.onError) this.onError(error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from server:', reason);
          this.isConnected = false;
          if (this.onDisconnect) this.onDisconnect(reason);
        });
      });
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw error;
    }
  }

  async getDiscordToken() {
    try {
      const sdk = discordIntegration.sdk;
      if (!sdk) {
        throw new Error('Discord SDK not available');
      }
      
      // Try multiple methods to get access token
      let token;
      
      // Method 1: Direct SDK command
      if (sdk.commands && sdk.commands.getAccessToken) {
        try {
          token = await sdk.commands.getAccessToken();
          if (token) return token;
        } catch (error) {
          console.warn('getAccessToken failed:', error);
        }
      }
      
      // Method 2: Check if token is available in SDK state
      if (sdk.state && sdk.state.accessToken) {
        token = sdk.state.accessToken;
        if (token) return token;
      }
      
      // Method 3: Check for token in URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('access_token') || urlParams.get('token');
      if (token) return token;
      
      // Method 4: Check localStorage/sessionStorage
      token = localStorage.getItem('discord_access_token') || sessionStorage.getItem('discord_access_token');
      if (token) return token;
      
      // Method 5: Generate a temporary token for development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Development mode: using temporary token');
        return 'dev-token-' + Date.now();
      }
      
      throw new Error('No access token available from any source');
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
