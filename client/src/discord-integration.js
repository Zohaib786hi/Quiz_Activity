class DiscordIntegration {
  constructor() {
    this.sdk = null;
    this.isInitialized = false;
    this.currentUser = null;
    this.activityId = null;
    this.roomId = null;
    this.onUserUpdate = null;
    this.onActivityUpdate = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
  }

  async initialize() {
    try {
      console.log('Starting Discord SDK initialization...');
      console.log('Window location:', window.location.href);
      console.log('Window parent:', window.parent !== window);
      console.log('User agent:', navigator.userAgent);
      console.log('Document referrer:', document.referrer);
      
      // Enhanced Discord environment detection
      const isDiscordEnvironment = 
        window.location.href.includes('discord.com') || 
        window.location.href.includes('discordapp.com') ||
        window.parent !== window ||
        document.referrer.includes('discord.com') ||
        document.referrer.includes('discordapp.com') ||
        window.location.search.includes('discord') ||
        window.location.hash.includes('discord') ||
        // Check for Discord-specific headers or properties
        (window.navigator && window.navigator.userAgent && 
         window.navigator.userAgent.toLowerCase().includes('discord')) ||
        // Check if we're in an iframe (common for Discord activities)
        (window.self !== window.top);
      
      console.log('Discord environment detection result:', isDiscordEnvironment);
      
      if (isDiscordEnvironment) {
        console.log('Detected Discord environment, attempting to initialize SDK...');
      } else {
        console.log('Not in Discord environment, will run in local mode');
        return false;
      }
      
      // Try multiple import methods with better error handling
      let getSdk;
      let sdkSource = 'unknown';
      
      try {
        console.log('Attempting dynamic import of Discord SDK...');
        const sdkModule = await import('@discord/embedded-app-sdk');
        console.log('SDK module imported:', sdkModule);
        getSdk = sdkModule.getSdk;
        sdkSource = 'dynamic-import';
        console.log('getSdk function found:', typeof getSdk);
      } catch (importError) {
        console.error('Dynamic import failed:', importError);
        
        // Try alternative methods
        if (window.DiscordSDK && window.DiscordSDK.getSdk) {
          console.log('Using global DiscordSDK');
          getSdk = window.DiscordSDK.getSdk;
          sdkSource = 'global-DiscordSDK';
        } else if (window.getSdk) {
          console.log('Using global getSdk');
          getSdk = window.getSdk;
          sdkSource = 'global-getSdk';
        } else if (window.discord && window.discord.getSdk) {
          console.log('Using window.discord.getSdk');
          getSdk = window.discord.getSdk;
          sdkSource = 'window-discord';
        } else {
          console.error('No alternative SDK source found');
          // Even if we can't find the SDK, we might still be in Discord
          // Let's create a minimal SDK-like interface for basic functionality
          console.log('Creating fallback SDK interface for Discord environment');
          this.sdk = this.createFallbackSDK();
          this.isInitialized = true;
          return true;
        }
      }
      
      if (!getSdk) {
        console.error('getSdk function not found in Discord SDK');
        // Create fallback SDK
        console.log('Creating fallback SDK interface');
        this.sdk = this.createFallbackSDK();
        this.isInitialized = true;
        return true;
      }
      
      console.log('Calling getSdk() from source:', sdkSource);
      try {
        this.sdk = await getSdk();
        console.log('SDK obtained:', this.sdk);
      } catch (sdkError) {
        console.error('getSdk() call failed:', sdkError);
        // Create fallback SDK
        console.log('Creating fallback SDK interface after getSdk failure');
        this.sdk = this.createFallbackSDK();
        this.isInitialized = true;
        return true;
      }
      
      if (!this.sdk) {
        console.error('SDK initialization returned null/undefined');
        // Create fallback SDK
        console.log('Creating fallback SDK interface after null SDK');
        this.sdk = this.createFallbackSDK();
        this.isInitialized = true;
        return true;
      }
      
      this.isInitialized = true;
      
      // Set up event listeners
      console.log('Setting up SDK event listeners...');
      
      // Check if subscribe method exists
      if (this.sdk.subscribe) {
        this.sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (data) => {
          console.log('Participants update:', data);
          if (this.onPlayerJoin) this.onPlayerJoin(data);
        });

        this.sdk.subscribe('ACTIVITY_INSTANCE_UPDATE', (data) => {
          console.log('Activity update:', data);
          this.activityId = data.activity_id;
          this.roomId = data.activity_id || 'default-room'; // Fallback room ID
          if (this.onActivityUpdate) this.onActivityUpdate(data);
        });
      } else {
        console.warn('SDK subscribe method not available');
      }

      // Get current user
      console.log('Getting current user...');
      if (this.sdk.commands && this.sdk.commands.getCurrentUser) {
        try {
          const user = await this.sdk.commands.getCurrentUser();
          console.log('Current user obtained:', user);
          this.currentUser = user;
          if (this.onUserUpdate) this.onUserUpdate(user);
        } catch (userError) {
          console.error('Failed to get current user:', userError);
          this.currentUser = this.createFallbackUser();
        }
      } else {
        console.warn('SDK getCurrentUser command not available');
        this.currentUser = this.createFallbackUser();
      }

      console.log('Discord SDK initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Discord SDK:', error);
      console.error('Error stack:', error.stack);
      // Create fallback SDK even on complete failure
      console.log('Creating fallback SDK interface after complete failure');
      this.sdk = this.createFallbackSDK();
      this.currentUser = this.createFallbackUser();
      this.isInitialized = true;
      return true;
    }
  }

  async getCurrentUser() {
    if (!this.isInitialized) {
      throw new Error('Discord SDK not initialized');
    }
    return this.currentUser;
  }

  async getActivityId() {
    if (!this.isInitialized) {
      throw new Error('Discord SDK not initialized');
    }
    return this.activityId;
  }

  async getRoomId() {
    if (!this.isInitialized) {
      throw new Error('Discord SDK not initialized');
    }
    return this.roomId;
  }

  async setActivity(activity) {
    if (!this.isInitialized) {
      throw new Error('Discord SDK not initialized');
    }
    
    try {
      await this.sdk.commands.setActivity(activity);
    } catch (error) {
      console.error('Failed to set activity:', error);
    }
  }

  async clearActivity() {
    if (!this.isInitialized) {
      throw new Error('Discord SDK not initialized');
    }
    
    try {
      await this.sdk.commands.clearActivity();
    } catch (error) {
      console.error('Failed to clear activity:', error);
    }
  }

  // Helper method to format activity for Discord
  formatActivityForDiscord(gameState) {
    const { currentQuestion, scores, players } = gameState;
    
    if (!currentQuestion) {
      return {
        name: "Age of Empires III Quiz",
        type: 0, // Playing
        state: "Waiting for players...",
        details: `Players: ${players?.length || 0}`,
        timestamps: {
          start: Date.now()
        },
        assets: {
          large_image: "quiz_icon",
          large_text: "Age of Empires III Quiz",
          small_image: "discord_logo",
          small_text: "Discord Activity"
        }
      };
    }

    return {
      name: "Age of Empires III Quiz",
      type: 0, // Playing
      state: currentQuestion.question?.substring(0, 128) || "Answering question...",
      details: `Players: ${players?.length || 0} | Time: ${gameState.timeLeft || 0}s`,
      timestamps: {
        start: Date.now()
      },
      assets: {
        large_image: "quiz_icon",
        large_text: "Age of Empires III Quiz",
        small_image: "discord_logo",
        small_text: "Discord Activity"
      }
    };
  }

  createFallbackSDK() {
    console.log('Creating fallback SDK interface');
    return {
      subscribe: (event, callback) => {
        console.log('Fallback SDK: subscribe called for', event);
        // No-op for fallback
      },
      commands: {
        getCurrentUser: async () => {
          console.log('Fallback SDK: getCurrentUser called');
          return this.createFallbackUser();
        },
        getAccessToken: async () => {
          console.log('Fallback SDK: getAccessToken called');
          return null;
        }
      }
    };
  }

  createFallbackUser() {
    return {
      id: 'discord-user-' + Date.now(),
      username: 'Discord Player',
      avatar: null,
      discriminator: '0000'
    };
  }
}

// Create singleton instance
const discordIntegration = new DiscordIntegration();
export default discordIntegration;
