import OpenAI from 'openai';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OPENAI_API_KEY } from './config';

class OpenAIService {
  constructor() {
    try {
      this.openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Only for development
      });
    } catch (error) {
      console.error('Failed to initialize OpenAI:', error);
      this.openai = null;
    }
    this.userContext = null;
    this.conversationHistory = [];
  }

  async initializeUserContext() {
    if (!auth.currentUser) return;
    
    try {
      // Load user data
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      // Load recent snaps with simplified query
      let recentSnaps = [];
      try {
        const snapsQuery = query(
          collection(db, 'snaps'),
          where('userId', '==', auth.currentUser.uid),
          limit(20)
        );
        const snapsSnapshot = await getDocs(snapsQuery);
        recentSnaps = snapsSnapshot.docs.map(doc => doc.data());
        
        // Sort client-side
        recentSnaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch (error) {
        console.log('Could not load snaps:', error);
      }
      
      // Build user context
      this.userContext = {
        username: userData.username || 'User',
        preferences: userData.preferences || {},
        postingStyle: this.analyzePostingStyle(recentSnaps),
        friendsList: userData.friends || [],
        interests: userData.interests || [],
        recentActivity: recentSnaps
      };
      
      console.log('User context initialized:', this.userContext.username);
    } catch (error) {
      console.error('Error initializing context:', error);
      this.userContext = {
        username: auth.currentUser.displayName || 'User',
        preferences: {},
        postingStyle: {},
        friendsList: [],
        interests: [],
        recentActivity: []
      };
    }
  }

  analyzePostingStyle(snaps) {
    const style = {
      averageCaptionLength: 0,
      emojiUsage: 0,
      postingTimes: [],
      favoriteFilters: {},
      themes: []
    };
    
    if (!snaps || snaps.length === 0) return style;
    
    snaps.forEach(snap => {
      if (snap.metadata?.text) {
        style.averageCaptionLength += snap.metadata.text.length;
        const emojis = snap.metadata.text.match(/[\u{1F600}-\u{1F64F}]/gu) || [];
        style.emojiUsage += emojis.length;
      }
      
      if (snap.timestamp) {
        style.postingTimes.push(new Date(snap.timestamp).getHours());
      }
      
      if (snap.metadata?.filter) {
        style.favoriteFilters[snap.metadata.filter] = (style.favoriteFilters[snap.metadata.filter] || 0) + 1;
      }
    });
    
    if (snaps.length > 0) {
      style.averageCaptionLength = Math.round(style.averageCaptionLength / snaps.length);
      style.emojiUsage = style.emojiUsage / snaps.length;
    }
    
    return style;
  }

  // 1. Smart Caption Generator
  async generateCaptions(imageContext = {}) {
    if (!this.openai) {
      return this.fallbackCaptionGenerator(imageContext);
    }

    try {
      const { filter, mood, time = new Date().getHours(), description } = imageContext;
      
      const systemPrompt = `You are a creative social media caption writer. Generate short, engaging captions.`;
      
      const userPrompt = `Generate 5 creative captions for a snap with:
        - Time: ${time < 12 ? 'morning' : time < 17 ? 'afternoon' : 'evening'}
        - Filter: ${filter || 'none'}
        - Mood: ${mood || 'casual'}
        
        Make captions: short (10-30 chars), fun, use emojis sparingly, vary in style`;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      });
      
      const captions = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/['"]/g, '').trim())
        .slice(0, 5);
      
      return captions.length > 0 ? captions : this.fallbackCaptionGenerator(imageContext);
    } catch (error) {
      console.error('Error generating captions:', error);
      return this.fallbackCaptionGenerator(imageContext);
    }
  }

  // 2. Best Time to Post Analysis
  async analyzeBestPostingTime() {
    return this.fallbackPostingTimeAnalysis();
  }

  // 3. Smart Reply Generator
  async generateSmartReplies(snapContext = {}) {
    if (!this.openai) {
      return this.fallbackReplyGenerator(snapContext);
    }

    try {
      const { senderName, hasText, filter } = snapContext;
      
      const systemPrompt = `Generate quick, casual snap replies. Keep them very short and friendly.`;
      
      const userPrompt = `Generate 8 quick replies for a snap from ${senderName || 'a friend'}. 
        Make them: 1-3 words max, casual, friendly, some with emojis, varied tone`;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 150
      });
      
      const replies = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/['"]/g, '').trim())
        .slice(0, 8);
      
      return replies.length > 0 ? replies : this.fallbackReplyGenerator(snapContext);
    } catch (error) {
      console.error('Error generating replies:', error);
      return this.fallbackReplyGenerator(snapContext);
    }
  }

  // 4. Story Ideas Generator
  async generateStoryIdeas() {
    if (!this.openai) {
      return this.fallbackStoryIdeas();
    }

    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const hour = new Date().getHours();
      
      const systemPrompt = `Generate creative, trendy story ideas for social media.`;
      
      const userPrompt = `Generate 10 story ideas for ${dayOfWeek} ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}.
        Make them: trendy, fun, achievable with phone, varied content types, 5-10 words each`;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 300
      });
      
      const ideas = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 10);
      
      return ideas.length > 0 ? ideas : this.fallbackStoryIdeas();
    } catch (error) {
      console.error('Error generating story ideas:', error);
      return this.fallbackStoryIdeas();
    }
  }

  // 5. Friendship Insights
  async analyzeFriendshipInsights() {
  try {
    console.log('Starting friendship insights analysis...');
    
    const friendData = await this.gatherFriendshipData();
    
    // Get user preferences
    let userPreferences = {};
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        userPreferences = userDoc.data().preferences || {};
      }
    }
    
    console.log('User preferences:', userPreferences);
    
    // Generate insights based on actual data and preferences
    const insights = [];
    const recommendations = [];
    
    // Basic activity insights
    if (friendData.totalFriends > 0) {
      if (friendData.activeFriends > 0) {
        const activeRate = Math.round((friendData.activeFriends / friendData.totalFriends) * 100);
        insights.push(`You're actively chatting with ${activeRate}% of your friends`);
        
        if (activeRate < 50) {
          recommendations.push("Reach out to friends you haven't talked to recently");
        }
      } else {
        insights.push("You haven't chatted with any friends yet");
        recommendations.push("Start a conversation to connect with your friends");
      }
    }
    
    // Top interaction insight
    if (friendData.topInteractions && friendData.topInteractions.length > 0) {
      const topFriend = friendData.topInteractions[0];
      insights.push(`Your most active chat is with ${topFriend.name} (${topFriend.messageCount} messages)`);
      
      if (friendData.topInteractions.length > 1) {
        const secondFriend = friendData.topInteractions[1];
        if (topFriend.messageCount > secondFriend.messageCount * 3) {
          recommendations.push("Try balancing your conversations across more friends");
        }
      }
    }
    
    // Message frequency insights based on preferences
    if (userPreferences.messageFrequency) {
      const avgMessagesPerFriend = friendData.activeFriends > 0 
        ? Math.round(friendData.totalMessages / friendData.activeFriends)
        : 0;
      
      if (userPreferences.messageFrequency === 'high' && avgMessagesPerFriend < 10) {
        insights.push("You prefer frequent chats but have been quieter than usual");
        recommendations.push("Try sending a quick hello to 3 friends today");
      } else if (userPreferences.messageFrequency === 'low' && avgMessagesPerFriend > 20) {
        insights.push("You're chatting more than your usual preference");
        recommendations.push("It's okay to take breaks from messaging when you need to");
      }
    }
    
    // Time-based insights
    if (userPreferences.bestTimeToChat && friendData.chatPatterns) {
      const preferredTime = userPreferences.bestTimeToChat;
      const actualPercentage = friendData.chatPatterns[preferredTime] || 0;
      
      if (actualPercentage > 0) {
        insights.push(`${actualPercentage}% of your chats happen during your preferred ${preferredTime} time`);
        
        if (actualPercentage < 30) {
          recommendations.push(`Try scheduling more chats in the ${preferredTime} when you're most comfortable`);
        }
      }
    }
    
    // Personality-based insights
    if (userPreferences.personality) {
      if (userPreferences.personality === 'introvert') {
        if (friendData.activeFriends > 5) {
          insights.push("You're managing a large social circle well as an introvert!");
          recommendations.push("Remember to take time for yourself between conversations");
        }
      } else if (userPreferences.personality === 'extrovert') {
        if (friendData.activeFriends < 3) {
          insights.push("As an extrovert, you might enjoy connecting with more friends");
          recommendations.push("Join group chats or reach out to new friends");
        }
      }
    }
    
    // Interest-based recommendations
    if (userPreferences.interests && userPreferences.interests.length > 0) {
      const randomInterest = userPreferences.interests[Math.floor(Math.random() * userPreferences.interests.length)];
      recommendations.push(`Share something about ${randomInterest} with a friend today`);
    }
    
    // Communication style recommendations
    if (userPreferences.preferredChatStyle) {
      switch (userPreferences.preferredChatStyle) {
        case 'casual':
          recommendations.push("Send a funny meme or emoji to brighten someone's day");
          break;
        case 'formal':
          recommendations.push("Write a thoughtful message asking about someone's goals");
          break;
        case 'mixed':
          recommendations.push("Mix it up with both casual jokes and deeper conversations");
          break;
      }
    }
    
    // Social preference insights
    if (userPreferences.likesGroupChats) {
      recommendations.push("Create a group chat for friends with similar interests");
    }
    
    if (userPreferences.prefersVideoChats) {
      recommendations.push("Suggest a video call to catch up more personally");
    }
    
    // Humor style recommendation
    if (userPreferences.humor) {
      switch (userPreferences.humor) {
        case 'sarcastic':
          recommendations.push("Share a witty observation about your day");
          break;
        case 'wholesome':
          recommendations.push("Send an encouraging message to someone who might need it");
          break;
        case 'witty':
          recommendations.push("Start a fun wordplay or pun conversation");
          break;
      }
    }
    
    // Make sure we always have some insights
    if (insights.length === 0) {
      insights.push("Complete your preferences to get personalized insights");
      insights.push("Start chatting to see your communication patterns");
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Send a snap to connect with friends");
      recommendations.push("Update your preferences for better recommendations");
    }
    
    console.log('Generated insights:', insights);
    console.log('Generated recommendations:', recommendations);
    
    return {
      insights: insights.slice(0, 5), // Limit to 5 insights
      recommendations: recommendations.slice(0, 3), // Limit to 3 recommendations
      preferences: userPreferences
    };
  } catch (error) {
    console.error('Error analyzing friendships:', error);
    return {
      insights: [
        "We're having trouble loading your insights",
        "Try chatting with friends to generate data",
        "Make sure your preferences are saved"
      ],
      recommendations: [
        "Check your internet connection",
        "Update your preferences in settings"
      ]
    };
  }
}

  // 6. Filter Recommendations
  async recommendFilters(imageAnalysis = {}) {
    const filters = ['none', 'grayscale', 'sepia', 'bright', 'dark', 'contrast', 'saturate'];
    const recommendations = [];
    
    // Simple recommendations based on context
    if (imageAnalysis.time && imageAnalysis.time < 8) {
      recommendations.push({ filter: 'bright', reason: 'Enhance morning light' });
    } else if (imageAnalysis.time && imageAnalysis.time > 18) {
      recommendations.push({ filter: 'dark', reason: 'Evening mood' });
    }
    
    recommendations.push(
      { filter: 'saturate', reason: 'Make colors pop' },
      { filter: 'contrast', reason: 'Add definition' },
      { filter: 'none', reason: 'Natural look' }
    );
    
    return recommendations.slice(0, 4);
  }

  // Helper methods
  async gatherEngagementData() {
    return {
      friendActivityByHour: { 8: 5, 12: 8, 19: 10 },
      userPostEngagement: { morning: 0.3, afternoon: 0.5, evening: 0.8 },
      dayOfWeekPatterns: { Monday: 0.4, Friday: 0.9, Weekend: 0.7 }
    };
  }

  async gatherFriendshipData() {
  try {
    if (!auth.currentUser) return {};
    
    console.log('Gathering friendship data for:', auth.currentUser.uid);
    
    // Get user's data
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userDoc.data() || {};
    const friendsCount = userData.friends?.length || 0;
    
    console.log('Total friends:', friendsCount);
    
    // Get user's chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const chatsSnapshot = await getDocs(chatsQuery);
    const chatActivity = {};
    const messageCount = {};
    let totalMessages = 0;
    const chatPatterns = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };
    
    console.log('Total chats found:', chatsSnapshot.size);
    
    // Analyze each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const otherParticipant = chatData.participants.find(id => id !== auth.currentUser.uid);
      
      if (otherParticipant) {
        // Get messages from this chat
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        
        try {
          const messagesSnapshot = await getDocs(messagesQuery);
          const messages = messagesSnapshot.docs.map(doc => doc.data());
          
          console.log(`Chat ${chatDoc.id} has ${messages.length} messages`);
          
          // Count messages per friend
          messageCount[otherParticipant] = messages.length;
          totalMessages += messages.length;
          
          // Analyze message times
          messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            if (hour >= 5 && hour < 12) chatPatterns.morning++;
            else if (hour >= 12 && hour < 17) chatPatterns.afternoon++;
            else if (hour >= 17 && hour < 22) chatPatterns.evening++;
            else chatPatterns.night++;
          });
          
          // Analyze last activity
          if (messages.length > 0) {
            const lastMessage = messages[0];
            chatActivity[otherParticipant] = {
              lastActivity: lastMessage.timestamp,
              messageCount: messages.length,
              friendName: chatData.participantNames?.[otherParticipant] || 'Friend'
            };
          }
        } catch (error) {
          console.log('Error getting messages for chat:', chatDoc.id, error);
        }
      }
    }
    
    // Calculate pattern percentages
    const totalPatternMessages = Object.values(chatPatterns).reduce((a, b) => a + b, 0);
    if (totalPatternMessages > 0) {
      Object.keys(chatPatterns).forEach(time => {
        chatPatterns[time] = Math.round((chatPatterns[time] / totalPatternMessages) * 100);
      });
    }
    
    // Calculate insights data
    const activeFriends = Object.keys(chatActivity);
    const topChats = Object.entries(chatActivity)
      .sort((a, b) => b[1].messageCount - a[1].messageCount)
      .slice(0, 3);
    
    const result = {
      totalFriends: friendsCount,
      activeFriends: activeFriends.length,
      totalMessages,
      topInteractions: topChats.map(([id, data]) => ({
        id,
        name: data.friendName,
        messageCount: data.messageCount,
        lastActivity: data.lastActivity
      })),
      inactiveFriends: friendsCount - activeFriends.length,
      chatPatterns
    };
    
    console.log('Friendship data gathered:', result);
    
    return result;
  } catch (error) {
    console.error('Error gathering friendship data:', error);
    return {
      totalFriends: 0,
      activeFriends: 0,
      totalMessages: 0,
      topInteractions: [],
      inactiveFriends: 0,
      chatPatterns: {}
    };
  }
}

  parseInsights(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const insights = [];
    const recommendations = [];
    
    let isRecommendations = false;
    lines.forEach(line => {
      const cleaned = line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim();
      if (cleaned.toLowerCase().includes('recommend')) {
        isRecommendations = true;
      } else if (cleaned.length > 5) {
        if (isRecommendations) {
          recommendations.push(cleaned);
        } else {
          insights.push(cleaned);
        }
      }
    });
    
    return {
      insights: insights.slice(0, 3),
      recommendations: recommendations.slice(0, 2)
    };
  }

  // Store feedback
  async updateContentFeedback(type, feedback) {
    console.log('Feedback stored:', type, feedback);
  }

  // Fallback methods
  fallbackCaptionGenerator(context) {
    const captions = [
      "Great moment! 📸", 
      "Living life ✨", 
      "Mood 💯", 
      "Vibes only",
      "Love this!",
      "Perfect day 🌟",
      "Feeling good 😊",
      "Just me 🤷"
    ];
    return captions.sort(() => Math.random() - 0.5).slice(0, 5);
  }

  fallbackReplyGenerator(context) {
    return ["😍", "Love it!", "Amazing!", "So good!", "Yes!!", "🔥🔥", "Wow!", "Nice! 👌"];
  }

  fallbackStoryIdeas() {
    const ideas = [
      "Day in my life",
      "Morning coffee vibes ☕",
      "What I'm eating today",
      "Current mood check",
      "Weekend plans reveal",
      "Behind the scenes",
      "Outfit of the day",
      "Workspace tour",
      "Favorite song right now",
      "Quick life update"
    ];
    return ideas;
  }

  fallbackPostingTimeAnalysis() {
    return [
      { time: "8:00 AM", reason: "Morning engagement peak" },
      { time: "12:30 PM", reason: "Lunch break activity" },
      { time: "7:00 PM", reason: "Evening prime time" }
    ];
  }

  fallbackFriendshipInsights() {
    return {
      insights: [
        "You have an active friend group!",
        "Your friends enjoy your content",
        "Great engagement with your snaps"
      ],
      recommendations: [
        "Send a snap to reconnect with someone",
        "Try posting at different times"
      ]
    };
  }
}

export default new OpenAIService();