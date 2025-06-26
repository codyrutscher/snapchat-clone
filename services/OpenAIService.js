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

  async gatherComprehensiveContext() {
    try {
      if (!auth.currentUser) return {};
      
      // Get user preferences
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data() || {};
      const preferences = userData.preferences || {};
      
      // Analyze recent conversations
      const conversationContext = await this.analyzeRecentConversations();
      
      // Analyze snap history
      const snapContext = await this.analyzeSnapHistory();
      
      // Analyze friend interactions
      const friendContext = await this.analyzeFriendInteractions();
      
      return {
        user: {
          username: userData.username,
          preferences: preferences,
          interests: preferences.interests || [],
          personality: preferences.personality || 'balanced',
          humor: preferences.humor || 'mixed',
          communicationStyle: preferences.preferredChatStyle || 'casual',
          friends: userData.friends || []
        },
        conversations: conversationContext,
        snapHistory: snapContext,
        friendships: friendContext,
        currentTime: new Date().getHours(),
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      };
    } catch (error) {
      console.error('Error gathering context:', error);
      return {};
    }
  }


async generateFullApp({ prompt, projectType, existingFiles }) {
  if (!this.openai) {
    return this.getFallbackApp(projectType);
  }

  try {
    let systemPrompt = '';
    let userPrompt = '';

    if (projectType === 'react') {
      systemPrompt = `You are an expert React developer. Create a complete, working React application.
      
      You must return ONLY a valid JSON object with this exact structure:
      {
        "name": "App Name",
        "type": "react",
        "files": {
          "App.js": "// Complete React component code here",
          "styles.css": "/* Complete CSS styles here */"
        }
      }
      
      Requirements:
      - App.js must be a complete, functional React component
      - Use functional components with hooks
      - Include all necessary imports
      - Make it interactive and visually appealing
      - Add proper error handling
      - Include responsive CSS in styles.css`;

      userPrompt = `Create a React app: ${prompt}. Return ONLY the JSON object, no explanations.`;
    } else if (projectType === 'vanilla') {
      systemPrompt = `You are an expert web developer. Create a complete, working vanilla JavaScript application.
      
      You must return ONLY a valid JSON object with this exact structure:
      {
        "name": "App Name",
        "type": "vanilla",
        "files": {
          "index.html": "<!-- Complete HTML here -->",
          "script.js": "// Complete JavaScript here",
          "styles.css": "/* Complete CSS here */"
        }
      }
      
      Requirements:
      - Create a complete, interactive web application
      - HTML should have proper structure
      - JavaScript should be modern and clean
      - CSS should make it visually appealing
      - Make it responsive`;

      userPrompt = `Create a web app: ${prompt}. Return ONLY the JSON object, no explanations.`;
    }

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4", // Use GPT-4 for better results
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000 // Increase token limit for complete apps
    });

    const response = completion.choices[0].message.content;
    console.log('AI Response:', response);

    try {
      // Clean the response to ensure valid JSON
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const appData = JSON.parse(cleanedResponse);
      
      // Validate the response has required structure
      if (!appData.files || Object.keys(appData.files).length === 0) {
        throw new Error('Invalid app structure');
      }
      
      return appData;
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Try to extract code from the response
      return this.extractAppFromResponse(response, projectType);
    }
  } catch (error) {
    console.error('Error generating app:', error);
    return this.getFallbackApp(projectType);
  }
}
  

  async analyzeSnapHistory() {
    try {
      const snapsQuery = query(
        collection(db, 'snaps'),
        where('userId', '==', auth.currentUser.uid),
        limit(30)
      );
      
      const snapshot = await getDocs(snapsQuery);
      const snapPatterns = {
        filters: {},
        backgrounds: {},
        borders: {},
        captionStyles: [],
        postingTimes: []
      };
      
      snapshot.forEach(doc => {
        const snap = doc.data();
        if (snap.metadata) {
          // Track filter usage
          if (snap.metadata.filter) {
            snapPatterns.filters[snap.metadata.filter] = (snapPatterns.filters[snap.metadata.filter] || 0) + 1;
          }
          
          // Track background usage
          if (snap.metadata.background) {
            snapPatterns.backgrounds[snap.metadata.background] = (snapPatterns.backgrounds[snap.metadata.background] || 0) + 1;
          }
          
          // Track caption styles
          if (snap.metadata.text) {
            snapPatterns.captionStyles.push({
              length: snap.metadata.text.length,
              hasEmoji: /[\u{1F600}-\u{1F64F}]/gu.test(snap.metadata.text),
              style: snap.metadata.text.length < 20 ? 'short' : 'long'
            });
          }
        }
        
        // Track posting times
        if (snap.timestamp) {
          snapPatterns.postingTimes.push(new Date(snap.timestamp).getHours());
        }
      });
      
      return snapPatterns;
    } catch (error) {
      console.error('Error analyzing snap history:', error);
      return {};
    }
  }

  async analyzeFriendInteractions() {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const friends = userDoc.data()?.friends || [];
      
      const friendInteractions = [];
      
      for (const friendId of friends.slice(0, 10)) { // Analyze top 10 friends
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          
          // Count snaps sent to this friend
          const snapsToFriend = await getDocs(query(
            collection(db, 'snaps'),
            where('userId', '==', auth.currentUser.uid),
            where('recipientId', '==', friendId),
            limit(10)
          ));
          
          friendInteractions.push({
            friendId: friendId,
            friendName: friendData.username,
            interests: friendData.preferences?.interests || [],
            snapCount: snapsToFriend.size,
            communicationStyle: friendData.preferences?.preferredChatStyle || 'unknown'
          });
        }
      }
      
      return friendInteractions.sort((a, b) => b.snapCount - a.snapCount);
    } catch (error) {
      console.error('Error analyzing friend interactions:', error);
      return [];
    }
  }

  getOtherParticipantName(chatData, currentUserId) {
    if (chatData.type === 'group') return chatData.name;
    const otherId = chatData.participants.find(id => id !== currentUserId);
    return chatData.participantNames?.[otherId] || 'Friend';
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

  // 1. Smart Caption Generator - Now with enhanced intelligence
  async generateCaptions(imageContext = {}) {
    return this.generateIntelligentCaptions(imageContext);
  }

  async generateIntelligentCaptions(imageContext = {}) {
    const comprehensiveContext = await this.gatherComprehensiveContext();
    
    if (!this.openai) {
      return this.contextAwareFallbackCaptions(comprehensiveContext, imageContext);
    }

    try {
      const { filter, background, border, mediaType, recipientName } = imageContext;
      
      // Build a rich prompt with all context
      const systemPrompt = `You are a social media caption writer who knows the user well. 
      User personality: ${comprehensiveContext.user.personality}
      Humor style: ${comprehensiveContext.user.humor}
      Communication style: ${comprehensiveContext.user.communicationStyle}
      Interests: ${comprehensiveContext.user.interests.join(', ')}
      Recent conversation topics: ${comprehensiveContext.conversations.recentTopics?.join(', ')}`;
      
      let userPrompt = `Generate 5 captions for a ${mediaType || 'photo'} snap`;
      
      if (recipientName) {
        const friendData = comprehensiveContext.friendships.find(f => f.friendName === recipientName);
        if (friendData) {
          userPrompt += `\nSending to: ${recipientName} (${friendData.communicationStyle} style)`;
          if (friendData.interests.length > 0) {
            userPrompt += `\nTheir interests: ${friendData.interests.join(', ')}`;
          }
        }
      }
      
      userPrompt += `\nTime: ${comprehensiveContext.currentTime < 12 ? 'morning' : comprehensiveContext.currentTime < 17 ? 'afternoon' : 'evening'}`;
      userPrompt += `\nDay: ${comprehensiveContext.dayOfWeek}`;
      userPrompt += `\nVisual style: ${filter || 'none'} filter, ${background || 'none'} background`;
      
      // Analyze past caption patterns
      if (comprehensiveContext.snapHistory?.captionStyles) {
        const avgLength = comprehensiveContext.snapHistory.captionStyles.reduce((acc, s) => acc + s.length, 0) / comprehensiveContext.snapHistory.captionStyles.length;
        userPrompt += `\nUser typically writes ${avgLength < 30 ? 'short' : 'medium'} captions`;
      }
      
      userPrompt += '\n\nMake captions contextual, personalized, and match the user\'s style.';
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300
      });
      
      const captions = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/['"]/g, '').trim())
        .slice(0, 5);
      
      return captions;
    } catch (error) {
      console.error('Error generating intelligent captions:', error);
      return this.contextAwareFallbackCaptions(comprehensiveContext, imageContext);
    }
  }

  contextAwareFallbackCaptions(context, imageContext) {
    const captions = [];
    const hour = new Date().getHours();
    const { personality, humor, interests } = context.user;
    
    // Time-based captions
    if (hour < 12) {
      captions.push("Morning vibes ☀️");
      captions.push("Rise and shine!");
    } else if (hour < 17) {
      captions.push("Afternoon mood 🌤");
      captions.push("Midday moments");
    } else {
      captions.push("Evening feels 🌙");
      captions.push("Night mode activated");
    }
    
    // Personality-based captions
    if (personality === 'extrovert') {
      captions.push("Living my best life!");
      captions.push("Who's joining? 🎉");
    } else if (personality === 'introvert') {
      captions.push("My happy place");
      captions.push("Peaceful moments");
    }
    
    // Interest-based captions
    if (interests && interests.length > 0) {
      captions.push(`${interests[0]} vibes ✨`);
    }
    
    // Filter-based captions
    if (imageContext.filter === 'grayscale') {
      captions.push("Classic mode 🖤");
    } else if (imageContext.filter === 'saturate') {
      captions.push("Color explosion 🌈");
    }
    
    return captions.slice(0, 5);
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

  // 4. Story Ideas Generator - Enhanced with developer context
  async generateStoryIdeas() {
    try {
      // Gather comprehensive context
      const context = await this.gatherComprehensiveContext();
      
      if (!this.openai) {
        return this.contextAwareStoryIdeas(context);
      }

      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      
      // Build context-aware prompt
      const systemPrompt = `You are a creative story idea generator for developers on a social app. 
      Generate ideas based on the user's context:
      - Programming languages: ${context.user.interests?.join(', ') || 'various'}
      - Work schedule: ${context.user.preferences?.workSchedule || 'flexible'}
      - Experience level: ${context.user.preferences?.experienceLevel || 'unknown'}
      - Current projects: ${context.user.preferences?.projectTypes || 'various'}
      - Learning goals: ${context.user.preferences?.learningGoals?.join(', ') || 'continuous learning'}
      - Recent chat topics: ${context.conversations.recentTopics?.slice(0, 3).join(', ') || 'general dev topics'}`;
      
      const userPrompt = `Generate 15 story ideas for ${dayOfWeek} ${timeOfDay} that mix:
      1. Developer-specific content (coding, debugging, project updates)
      2. Personal interests from their profile
      3. Topics from recent conversations
      4. General tech trends
      5. Fun developer life moments
      
      Make them short (5-10 words), engaging, and varied. Include emojis where appropriate.`;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 400
      });
      
      const ideas = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(idea => idea.length > 0)
        .slice(0, 15);
      
      return ideas.length > 0 ? ideas : this.contextAwareStoryIdeas(context);
    } catch (error) {
      console.error('Error generating story ideas:', error);
      const context = await this.gatherComprehensiveContext();
      return this.contextAwareStoryIdeas(context);
    }
  }

  // Add this new fallback method for context-aware story ideas
  contextAwareStoryIdeas(context) {
    const ideas = [];
    const hour = new Date().getHours();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    // Time-based developer ideas
    if (hour < 12) {
      ideas.push("Morning standup highlights 📊");
      ideas.push("Coffee count: loading... ☕");
      ideas.push("Today's coding playlist 🎵");
    } else if (hour < 17) {
      ideas.push("Lunch break coding challenge");
      ideas.push("Afternoon debugging session 🐛");
      ideas.push("Code review discoveries");
    } else {
      ideas.push("After hours side project 🚀");
      ideas.push("Evening commit count 📈");
      ideas.push("Night owl coding session 🦉");
    }
    
    // Based on programming languages
    if (context.user.preferences?.primaryLanguages) {
      const langs = context.user.preferences.primaryLanguages;
      if (langs.includes('JavaScript')) {
        ideas.push("JavaScript tip of the day 💡");
        ideas.push("npm install adventures");
      }
      if (langs.includes('Python')) {
        ideas.push("Python one-liner magic 🐍");
        ideas.push("pip install shenanigans");
      }
      if (langs.includes('Go') || langs.includes('Rust')) {
        ideas.push("Systems programming wins 🏆");
      }
    }
    
    // Based on frameworks
    if (context.user.preferences?.frameworks) {
      const frameworks = context.user.preferences.frameworks;
      if (frameworks.includes('React')) {
        ideas.push("React hooks explained simply");
        ideas.push("Component lifecycle moments");
      }
      if (frameworks.includes('Django') || frameworks.includes('Flask')) {
        ideas.push("Backend API progress update");
      }
    }
    
    // Based on work style
    if (context.user.preferences?.workSchedule === 'night-owl') {
      ideas.push("3am coding breakthrough 🌙");
      ideas.push("Late night deploy stories");
    } else if (context.user.preferences?.workSchedule === 'early-bird') {
      ideas.push("5am productivity hack");
      ideas.push("Early morning code wins");
    }
    
    // Based on experience level
    if (context.user.preferences?.experienceLevel === 'senior' || 
        context.user.preferences?.experienceLevel === 'principal') {
      ideas.push("Mentoring junior devs today");
      ideas.push("Architecture decisions explained");
      ideas.push("Tech lead daily struggles");
    } else if (context.user.preferences?.experienceLevel === 'junior') {
      ideas.push("Learning progress update 📚");
      ideas.push("First PR celebration 🎉");
      ideas.push("Asking for code help");
    }
    
    // Based on project type
    if (context.user.preferences?.projectTypes === 'frontend') {
      ideas.push("CSS magic tricks ✨");
      ideas.push("UI/UX improvements today");
    } else if (context.user.preferences?.projectTypes === 'backend') {
      ideas.push("Database optimization wins");
      ideas.push("API performance boost 🚀");
    } else if (context.user.preferences?.projectTypes === 'fullstack') {
      ideas.push("Frontend vs Backend today");
      ideas.push("Full stack juggling act");
    }
    
    // Based on collaboration preferences
    if (context.user.preferences?.pairProgramming) {
      ideas.push("Pair programming session recap");
    }
    if (context.user.preferences?.openSource) {
      ideas.push("Open source contribution 🌟");
      ideas.push("GitHub stars update");
    }
    
    // Based on learning goals
    if (context.user.preferences?.learningGoals?.length > 0) {
      const goal = context.user.preferences.learningGoals[0];
      ideas.push(`Learning ${goal} progress`);
    }
    
    // Fun developer life ideas
    ideas.push("Bug that fixed itself 🤔");
    ideas.push("Code works, nobody knows why");
    ideas.push("Git commit message hall of fame");
    ideas.push("Stack Overflow saved me again");
    ideas.push("Localhost:3000 adventures");
    ideas.push("Console.log debugging life");
    ideas.push("Code compiles first try! 🎊");
    ideas.push("Meeting that should've been PR");
    ideas.push("Tabs vs Spaces debate");
    ideas.push("My dev environment tour");
    
    // Weekend specific
    if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
      ideas.push("Weekend project progress");
      ideas.push("Hackathon vibes 💻");
      ideas.push("Learning new tech stack");
    }
    
    // Based on recent conversations
    if (context.conversations?.activeConversations?.length > 0) {
      ideas.push("Collab project sneak peek");
      ideas.push("Code review highlights");
    }
    
    // Randomize and return top 15
    return ideas
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);
  }

  // Also update the fallbackStoryIdeas to be more developer-focused
  fallbackStoryIdeas() {
    const ideas = [
      "Debug diary: Day 47 🐛",
      "Deployed to production! 🚀",
      "Code review adventures",
      "My terminal setup tour",
      "Favorite VS Code extensions",
      "Git commit of the day",
      "Stack Overflow hero moment",
      "Rubber duck debugging session",
      "Coffee to code ratio 📊",
      "Weekend project reveal",
      "Learning new framework",
      "Coding playlist drop 🎵",
      "Home office setup tour",
      "Merge conflict survivor",
      "Documentation actually helped!"
    ];
    return ideas.sort(() => Math.random() - 0.5).slice(0, 10);
  }

  // 5. Friendship Insights
  async analyzeFriendshipInsights() {
    try {
      console.log('Starting developer friendship insights analysis...');
      
      const friendData = await this.gatherFriendshipData();
      
      // Get user preferences
      let userPreferences = {};
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          userPreferences = userDoc.data().preferences || {};
        }
      }
      
      console.log('Developer preferences:', userPreferences);
      
      // Generate developer-specific insights
      const insights = [];
      const recommendations = [];
      
      // Tech stack matching insights
      if (userPreferences.primaryLanguages && userPreferences.primaryLanguages.length > 0) {
        insights.push(`You code in ${userPreferences.primaryLanguages.join(', ')} - great for finding collaboration partners`);
        
        if (userPreferences.primaryLanguages.includes('JavaScript')) {
          recommendations.push("Connect with other JS developers for code reviews");
        }
      }
      
      // Work schedule insights
      if (userPreferences.workSchedule) {
        const scheduleMap = {
          'early-bird': 'morning coding sessions',
          'night-owl': 'late night debugging sessions',
          'nine-to-five': 'regular work hours',
          'flexible': 'anytime coding'
        };
        insights.push(`Your ${scheduleMap[userPreferences.workSchedule]} schedule matches ${Math.floor(Math.random() * 30) + 20}% of your friends`);
      }
      
      // Collaboration insights
      if (userPreferences.pairProgramming) {
        insights.push("You enjoy pair programming - perfect for collaborative projects");
        recommendations.push("Start a pair programming session this week");
      }
      
      if (userPreferences.openSource) {
        insights.push("Open source contributor detected! 🎉");
        recommendations.push("Share your latest open source project with friends");
      }
      
      // Experience level insights
      if (userPreferences.experienceLevel) {
        if (userPreferences.experienceLevel === 'senior' || userPreferences.experienceLevel === 'principal') {
          if (userPreferences.mentoring) {
            insights.push("You're available for mentoring - helping shape the next generation of devs");
            recommendations.push("Offer to mentor a junior developer friend");
          } else {
            recommendations.push("Consider mentoring - your experience is valuable");
          }
        } else if (userPreferences.experienceLevel === 'junior') {
          recommendations.push("Connect with senior devs in your network for guidance");
        }
      }
      
      // Project type insights
      if (userPreferences.projectTypes) {
        const projectMap = {
          'frontend': 'UI/UX enthusiast',
          'backend': 'API architect',
          'fullstack': 'Full-stack ninja',
          'mobile': 'Mobile app developer'
        };
        insights.push(`As a ${projectMap[userPreferences.projectTypes]}, you can collaborate on diverse projects`);
      }
      
      // IDE and workflow insights
      if (userPreferences.preferredIDE === 'vim') {
        insights.push("Vim user detected - you value efficiency and keyboard mastery");
      } else if (userPreferences.preferredIDE === 'vscode') {
        insights.push("VS Code user - part of the 70% majority of developers");
      }
      
      // Tabs vs Spaces insight
      if (userPreferences.tabsVsSpaces) {
        const tabsVsSpacesJoke = userPreferences.tabsVsSpaces === 'tabs' 
          ? "Team Tabs! May the debates be ever in your favor"
          : "Team Spaces! The righteous path of clean code";
        insights.push(tabsVsSpacesJoke);
      }
      
      // Caffeine dependency humor
      if (userPreferences.caffeineDependency === 'high') {
        insights.push("☕☕☕ High caffeine dependency - a true developer!");
      }
      
      // Learning goals recommendations
      if (userPreferences.learningGoals && userPreferences.learningGoals.length > 0) {
        const randomGoal = userPreferences.learningGoals[Math.floor(Math.random() * userPreferences.learningGoals.length)];
        recommendations.push(`Share your ${randomGoal} learning journey with friends`);
      }
      
      // Activity-based insights
      if (friendData.totalFriends > 0) {
        if (friendData.activeFriends > 0) {
          const activeRate = Math.round((friendData.activeFriends / friendData.totalFriends) * 100);
          insights.push(`You're actively chatting with ${activeRate}% of your dev network`);
          
          if (activeRate < 50) {
            recommendations.push("Reach out to devs you haven't talked to - share a cool repo or article");
          }
        }
      }
      
      // Framework specific recommendations
      if (userPreferences.frameworks && userPreferences.frameworks.includes('React')) {
        recommendations.push("Share a React tip or trick with your network");
      }
      
      // Remote work recommendation
      if (userPreferences.remoteWork) {
        recommendations.push("Organize a virtual coding session with remote friends");
      }
      
      // Make sure we always have some insights
      if (insights.length === 0) {
        insights.push("Complete your developer preferences for personalized insights");
        insights.push("Start connecting with fellow developers");
      }
      
      if (recommendations.length === 0) {
        recommendations.push("Share a code snippet today");
        recommendations.push("Ask for code review on your latest commit");
      }
      
      console.log('Generated developer insights:', insights);
      console.log('Generated developer recommendations:', recommendations);
      
      return {
        insights: insights.slice(0, 6), // Increased from 5 to 6
        recommendations: recommendations.slice(0, 4), // Increased from 3 to 4
        preferences: userPreferences
      };
    } catch (error) {
      console.error('Error analyzing friendships:', error);
      return {
        insights: [
          "Configure your developer preferences for insights",
          "Connect with fellow coders",
          "Share your tech stack"
        ],
        recommendations: [
          "Update your developer preferences",
          "Join the developer community"
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

  // 7. Friend Recommendations - Enhanced with code sharing patterns
  async generateFriendRecommendations() {
    const context = await this.gatherComprehensiveContext();
    
    try {
      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const currentUserFriends = context.user.friends || [];
      const recommendations = [];
      
      // Get code sharing patterns
      const codePatterns = await this.getCodeSharingPatterns();
      
      usersSnapshot.forEach(doc => {
        if (doc.id === auth.currentUser.uid) return; // Skip self
        if (currentUserFriends.includes(doc.id)) return; // Skip existing friends
        
        const userData = doc.data();
        let score = 0;
        
        // NEW: Programming language compatibility
        if (userData.preferences?.primaryLanguages && context.user.preferences?.primaryLanguages) {
          const commonLanguages = userData.preferences.primaryLanguages.filter(
            lang => context.user.preferences.primaryLanguages.includes(lang)
          );
          score += commonLanguages.length * 15; // Higher weight for language match
        }
        
        // NEW: Framework compatibility
        if (userData.preferences?.frameworks && context.user.preferences?.frameworks) {
          const commonFrameworks = userData.preferences.frameworks.filter(
            framework => context.user.preferences.frameworks.includes(framework)
          );
          score += commonFrameworks.length * 12;
        }
        
        // NEW: Project type compatibility
        if (userData.preferences?.projectTypes === context.user.preferences?.projectTypes) {
          score += 10;
        }
        
        // NEW: Experience level compatibility for mentoring
        if (context.user.preferences?.experienceLevel === 'junior' && 
            userData.preferences?.experienceLevel === 'senior' && 
            userData.preferences?.mentoring) {
          score += 20; // High score for mentor matches
        }
        
        // NEW: Work schedule compatibility for pair programming
        if (userData.preferences?.workSchedule === context.user.preferences?.workSchedule &&
            userData.preferences?.pairProgramming && context.user.preferences?.pairProgramming) {
          score += 15;
        }
        
        // Original scoring factors
        if (userData.preferences?.interests && context.user.interests) {
          const commonInterests = userData.preferences.interests.filter(
            interest => context.user.interests.includes(interest)
          );
          score += commonInterests.length * 10;
        }
        
        if (userData.preferences?.personality === context.user.personality) {
          score += 5;
        }
        
        if (userData.preferences?.preferredChatStyle === context.user.communicationStyle) {
          score += 5;
        }
        
        if (score > 0) {
          recommendations.push({
            userId: doc.id,
            username: userData.username,
            score: score,
            commonLanguages: userData.preferences?.primaryLanguages?.filter(
              lang => context.user.preferences?.primaryLanguages?.includes(lang)
            ) || [],
            commonFrameworks: userData.preferences?.frameworks?.filter(
              framework => context.user.preferences?.frameworks?.includes(framework)
            ) || [],
            commonInterests: userData.preferences?.interests?.filter(
              interest => context.user.interests?.includes(interest)
            ) || [],
            reason: this.generateEnhancedRecommendationReason(userData, context, score)
          });
        }
      });
      
      // Sort by score and return top 5
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } catch (error) {
      console.error('Error generating friend recommendations:', error);
      return [];
    }
  }

  // Get code sharing patterns for recommendations
  async getCodeSharingPatterns() {
    try {
      const patterns = {
        sharedLanguages: {},
        receivedLanguages: {},
        totalShares: 0
      };
      
      // Query code sharing history
      const sharingQuery = query(
        collection(db, 'codeSharing'),
        where('userId', '==', auth.currentUser.uid),
        limit(50)
      );
      
      const snapshot = await getDocs(sharingQuery);
      snapshot.forEach(doc => {
        const data = doc.data();
        patterns.sharedLanguages[data.language] = (patterns.sharedLanguages[data.language] || 0) + 1;
        patterns.totalShares++;
      });
      
      return patterns;
    } catch (error) {
      console.error('Error getting code patterns:', error);
      return {};
    }
  }

  generateEnhancedRecommendationReason(userData, context, score) {
    const reasons = [];
    
    // Programming language matches
    if (userData.preferences?.primaryLanguages && context.user.preferences?.primaryLanguages) {
      const common = userData.preferences.primaryLanguages.filter(
        lang => context.user.preferences.primaryLanguages.includes(lang)
      );
      if (common.length > 0) {
        reasons.push(`Codes in ${common.join(', ')}`);
      }
    }
    
    // Framework matches
    if (userData.preferences?.frameworks && context.user.preferences?.frameworks) {
      const common = userData.preferences.frameworks.filter(
        fw => context.user.preferences.frameworks.includes(fw)
      );
      if (common.length > 0) {
        reasons.push(`Uses ${common[0]}`);
      }
    }
    
    // Mentoring match
    if (context.user.preferences?.experienceLevel === 'junior' && 
        userData.preferences?.experienceLevel === 'senior' && 
        userData.preferences?.mentoring) {
      reasons.push('Available for mentoring');
    }
    
    // Pair programming match
    if (userData.preferences?.pairProgramming && context.user.preferences?.pairProgramming) {
      reasons.push('Enjoys pair programming');
    }
    
    // Project type match
    if (userData.preferences?.projectTypes === context.user.preferences?.projectTypes) {
      reasons.push(`${userData.preferences.projectTypes} developer`);
    }
    
    return reasons[0] || 'Great match for collaboration';
  }

  // 8. Generate code snippets
  async generateCode({ prompt, language, context }) {
    if (!this.openai) {
      return this.getFallbackCode(language);
    }

    try {
      const systemPrompt = `You are an expert ${language} developer. Generate clean, efficient, and well-commented code. Follow best practices and modern patterns.`;
      
      let userPrompt = `Generate ${language} code for: ${prompt}`;
      if (context) {
        userPrompt += `\n\nExisting code context:\n${context}\n\nIntegrate with the above code appropriately.`;
      }

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating code:', error);
      return this.getFallbackCode(language);
    }
  }

  getFallbackCode(language) {
    const fallbacks = {
      javascript: '// JavaScript code\nfunction example() {\n  console.log("Hello World");\n}',
      python: '# Python code\ndef example():\n    print("Hello World")',
      java: '// Java code\npublic class Example {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}'
    };
    return fallbacks[language] || '// Code generation unavailable';
  }

  // Continue with remaining helper methods...

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