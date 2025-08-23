import { getSdk } from '@discord/embedded-app-sdk';

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
      this.sdk = await getSdk();
      this.isInitialized = true;
      
      // Set up event listeners
      this.sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (data) => {
        console.log('Participants update:', data);
        if (this.onPlayerJoin) this.onPlayerJoin(data);
      });

      this.sdk.subscribe('ACTIVITY_INSTANCE_UPDATE', (data) => {
        console.log('Activity update:', data);
        this.activityId = data.activity_id;
        this.roomId = data.activity_id; // Use activity ID as room ID
        if (this.onActivityUpdate) this.onActivityUpdate(data);
      });

      // Get current user
      const user = await this.sdk.commands.getCurrentUser();
      this.currentUser = user;
      if (this.onUserUpdate) this.onUserUpdate(user);

      console.log('Discord SDK initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Discord SDK:', error);
      return false;
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
}

// Create singleton instance
const discordIntegration = new DiscordIntegration();
export default discordIntegration;
