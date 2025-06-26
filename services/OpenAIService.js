import OpenAI from 'openai';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OPENAI_API_KEY } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class OpenAIService {
  constructor() {
    try {
      console.log('Initializing OpenAI with API key:', OPENAI_API_KEY ? 'Present' : 'Missing');
      this.openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Only for development
      });
      console.log('OpenAI initialized successfully');
      
      // Test the API connection
      this.testAPIConnection();
    } catch (error) {
      console.error('Failed to initialize OpenAI:', error);
      console.error('Error details:', error.message);
      this.openai = null;
    }
    this.userContext = null;
    this.conversationHistory = [];
  }

  async testAPIConnection() {
    try {
      console.log('Testing OpenAI API connection...');
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say 'API working'" }],
        max_tokens: 10
      });
      console.log('OpenAI API test successful:', response.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI API test failed:', error);
      console.error('API Error details:', error.response?.data || error.message);
      this.openai = null; // Disable OpenAI if test fails
    }
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
      console.log('Gathering comprehensive context for RAG...');
      if (!auth.currentUser) {
        console.log('No authenticated user');
        return {};
      }
      
      // Get user preferences
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data() || {};
      const preferences = userData.preferences || {};
      console.log('User preferences loaded:', Object.keys(preferences));
      
      // Analyze recent conversations
      const conversationContext = await this.analyzeRecentConversations();
      
      // Analyze snap history
      const snapContext = await this.analyzeSnapHistory();
      
      // Analyze friend interactions
      const friendContext = await this.analyzeFriendInteractions();
      
      // NEW: Analyze code sharing patterns for RAG
      const codeContext = await this.analyzeCodeSharingPatterns();
      
      // NEW: Get recent code snippets for context
      const recentSnippets = await this.getRecentCodeSnippets();
      
      console.log('Code context:', codeContext);
      console.log('Recent snippets:', recentSnippets?.length || 0);
      
      return {
        user: {
          username: userData.username,
          preferences: preferences,
          interests: preferences.interests || [],
          personality: preferences.personality || 'balanced',
          humor: preferences.humor || 'mixed',
          communicationStyle: preferences.preferredChatStyle || 'casual',
          friends: userData.friends || [],
          // NEW: Developer-specific preferences
          primaryLanguages: preferences.primaryLanguages || ['javascript'],
          frameworks: preferences.frameworks || [],
          experienceLevel: preferences.experienceLevel || 'intermediate',
          workSchedule: preferences.workSchedule || 'flexible',
          preferredIDE: preferences.preferredIDE || 'vscode'
        },
        conversations: conversationContext,
        snapHistory: snapContext,
        friendships: friendContext,
        // NEW: Code-related context
        codePatterns: codeContext,
        recentSnippets: recentSnippets,
        currentTime: new Date().getHours(),
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      };
    } catch (error) {
      console.error('Error gathering context:', error);
      // Return default structure even on error
      return {
        user: {
          username: 'Developer',
          preferences: {},
          interests: [],
          personality: 'balanced',
          humor: 'mixed',
          communicationStyle: 'casual',
          friends: [],
          primaryLanguages: ['javascript'],
          frameworks: [],
          experienceLevel: 'intermediate',
          workSchedule: 'flexible',
          preferredIDE: 'vscode'
        },
        conversations: { recentTopics: [], activeConversations: [] },
        snapHistory: {},
        friendships: [],
        codePatterns: { languages: {}, timePatterns: {} },
        recentSnippets: [],
        currentTime: new Date().getHours(),
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' })
      };
    }
  }

   async analyzeCodeTopic(code) {
  const keywords = {
    web: ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'dom', 'browser'],
    backend: ['api', 'server', 'database', 'sql', 'mongodb', 'express', 'node'],
    mobile: ['react native', 'ios', 'android', 'swift', 'kotlin', 'flutter'],
    data: ['pandas', 'numpy', 'matplotlib', 'tensorflow', 'machine learning', 'data'],
    devops: ['docker', 'kubernetes', 'ci/cd', 'aws', 'deploy', 'pipeline'],
    algorithms: ['algorithm', 'sort', 'search', 'complexity', 'recursion', 'dynamic programming']
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(word => code.toLowerCase().includes(word))) {
      return topic;
    }
  }
  
  return 'general';
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
    console.log('--- Generating Intelligent Captions ---');
    const comprehensiveContext = await this.gatherComprehensiveContext();
    console.log('Comprehensive Context:', JSON.stringify(comprehensiveContext, null, 2));

    if (!this.openai) {
      console.log('OpenAI not available, returning empty');
      return [];
    }

    try {
      console.log('Using OpenAI API for caption generation...');
      const { filter, background, border, mediaType, recipientName } = imageContext;
      
      const systemPrompt = `You are a social media caption writer who deeply understands the user's personality and coding lifestyle.
      
      User Profile:
      - Personality: ${comprehensiveContext.user.personality}
      - Humor style: ${comprehensiveContext.user.humor}
      - Communication: ${comprehensiveContext.user.communicationStyle}
      - Interests: ${comprehensiveContext.user.interests.join(', ')}
      
      Developer Profile:
      - Primary languages: ${comprehensiveContext.user.primaryLanguages.join(', ')}
      - Experience: ${comprehensiveContext.user.experienceLevel}
      - Work schedule: ${comprehensiveContext.user.workSchedule}
      - Preferred IDE: ${comprehensiveContext.user.preferredIDE}
      
      Recent Activity:
      - Most used languages: ${Object.entries(comprehensiveContext.codePatterns.languages || {}).sort((a,b) => b[1] - a[1]).slice(0,3).map(([lang]) => lang).join(', ')}
      - Recent code topics: ${comprehensiveContext.recentSnippets.map(s => s.topic).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
      - Conversation topics: ${comprehensiveContext.conversations.recentTopics?.join(', ')}`;
      
      let userPrompt = `Generate 5 captions for a ${mediaType || 'photo'} snap that blend personal moments with developer culture.`;
      
      if (recipientName) {
        const friendData = comprehensiveContext.friendships.find(f => f.friendName === recipientName);
        if (friendData) {
          userPrompt += `\nSending to: ${recipientName} (${friendData.communicationStyle} style)`;
          if (friendData.interests.length > 0) {
            userPrompt += `\nTheir interests: ${friendData.interests.join(', ')}`;
          }
        }
      }
      
      const hour = comprehensiveContext.currentTime;
      const timeContext = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'late night';
      userPrompt += `\nTime: ${timeContext} (${hour}:00)`;
      userPrompt += `\nDay: ${comprehensiveContext.dayOfWeek}`;
      
      if (comprehensiveContext.user.workSchedule === 'night-owl' && hour > 22) {
        userPrompt += '\nNote: User is a night owl developer, reference late-night coding if appropriate';
      } else if (comprehensiveContext.user.workSchedule === 'early-bird' && hour < 7) {
        userPrompt += '\nNote: User is an early bird developer, reference morning productivity';
      }
      
      userPrompt += `\nVisual style: ${filter || 'none'} filter, ${background || 'none'} background`;
      
      if (comprehensiveContext.codePatterns.timePatterns) {
        const mostActiveTime = Object.entries(comprehensiveContext.codePatterns.timePatterns)
          .sort((a, b) => b[1] - a[1])[0];
        if (mostActiveTime) {
          userPrompt += `\nUser most actively shares code in the ${mostActiveTime[0]}`;
        }
      }
      
      if (comprehensiveContext.recentSnippets.length > 0) {
        const recentLang = comprehensiveContext.recentSnippets[0].language;
        userPrompt += `\nRecently worked with ${recentLang}`;
      }
      
      userPrompt += `\n\nCreate captions that:\n      1. Feel natural and match the user's communication style\n      2. Occasionally reference coding/tech when it fits naturally\n      3. Match the time of day and context\n      4. Are creative and engaging\n      5. Vary in length and tone`;

      console.log('--- OpenAI Request ---');
      console.log('System Prompt:', systemPrompt);
      console.log('User Prompt:', userPrompt);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300
      });

      console.log('--- OpenAI Response ---');
      console.log('API Response:', JSON.stringify(completion, null, 2));
      
      const captions = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/['"]/g, '').trim())
        .slice(0, 5);
      
      console.log('Generated captions:', captions);
      return captions;
    } catch (error) {
      console.error('Error generating intelligent captions:', error);
      console.error('Error details:', error.response?.data || error.message);
      return [];
    }
  }

  // 2. Best Time to Post Analysis
  async analyzeBestPostingTime() {
    if (!this.openai) {
      return [];
    }
    // Placeholder for OpenAI-based analysis
    return [];
  }

  // 3. Smart Reply Generator
  async generateSmartReplies(snapContext = {}) {
    if (!this.openai) {
      return [];
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
      
      return replies.length > 0 ? replies : [];
    } catch (error) {
      console.error('Error generating replies:', error);
      return [];
    }
  }

  // 4. Story Ideas Generator - Enhanced with developer context
  async generateStoryIdeas() {
    try {
      // Gather comprehensive context
      const context = await this.gatherComprehensiveContext();
      
      if (!this.openai) {
        return [];
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
      
      return ideas.length > 0 ? ideas : [];
    } catch (error) {
      console.error('Error generating story ideas:', error);
      return [];
    }
  }

  // 5. Friendship Insights - Enhanced with RAG
  async analyzeFriendshipInsights() {
    try {
      console.log('Starting RAG-enhanced developer friendship insights analysis...');
      
      const friendData = await this.gatherFriendshipData();
      
      // Get comprehensive context for RAG
      const comprehensiveContext = await this.gatherComprehensiveContext();
      
      // Get user preferences
      let userPreferences = {};
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          userPreferences = userDoc.data().preferences || {};
        }
      }
      
      // Get code sharing patterns for RAG
      const codePatterns = await this.analyzeCodeSharingPatterns();
      
      // Get recent interactions for RAG
      const recentInteractions = await this.analyzeRecentInteractions();
      
      console.log('Developer preferences:', userPreferences);
      console.log('Code patterns for RAG:', codePatterns);
      console.log('Recent interactions:', recentInteractions);
      
      // Generate developer-specific insights with RAG
      const insights = [];
      const recommendations = [];
      
      // RAG-based tech stack insights
      if (codePatterns.languageFrequency && Object.keys(codePatterns.languageFrequency).length > 0) {
        const topLanguage = Object.entries(codePatterns.languageFrequency)
          .sort((a, b) => b[1] - a[1])[0][0];
        insights.push(`You've shared ${topLanguage} code ${codePatterns.languageFrequency[topLanguage]} times recently`);
        
        // Find friends with similar language preferences
        const friendsWithSameLanguage = comprehensiveContext.friendActivity?.friendLanguages
          ?.filter(f => f.languages.includes(topLanguage))
          ?.length || 0;
        if (friendsWithSameLanguage > 0) {
          insights.push(`${friendsWithSameLanguage} friends also code in ${topLanguage} - perfect for collaboration`);
        }
      }
      
      // Tech stack matching insights
      if (userPreferences.primaryLanguages && userPreferences.primaryLanguages.length > 0) {
        insights.push(`You code in ${userPreferences.primaryLanguages.join(', ')} - great for finding collaboration partners`);
        
        if (userPreferences.primaryLanguages.includes('JavaScript')) {
          recommendations.push("Connect with other JS developers for code reviews");
        }
      }
      
      // RAG-based activity insights
      if (recentInteractions.activeChats > 0) {
        insights.push(`You've had ${recentInteractions.activeChats} active coding discussions this week`);
        
        if (recentInteractions.codeSnippetsShared > 0) {
          insights.push(`Shared ${recentInteractions.codeSnippetsShared} code snippets with friends`);
        }
      }
      
      // RAG-based collaboration insights
      if (codePatterns.collaborationScore) {
        if (codePatterns.collaborationScore > 7) {
          insights.push("You're a highly collaborative developer - keep sharing knowledge!");
        } else if (codePatterns.collaborationScore < 4) {
          recommendations.push("Share more code snippets to boost collaboration");
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
        }
      } else if (userPreferences.experienceLevel === 'junior') {
        recommendations.push("Connect with senior devs in your network for guidance");
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
        insights: [],
        recommendations: []
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

  

  // Helper function for RAG-based code sharing patterns
  async analyzeCodeSharingPatterns() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return { languageFrequency: {}, collaborationScore: 0 };
      
      // Get recent code shares
      const codeSharesQuery = query(
        collection(db, 'codeSharing'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(30)
      );
      
      const languageFrequency = {};
      let totalShares = 0;
      
      try {
        const snapshot = await getDocs(codeSharesQuery);
        snapshot.forEach(doc => {
          const data = doc.data();
          totalShares++;
          if (data.language) {
            languageFrequency[data.language] = (languageFrequency[data.language] || 0) + 1;
          }
        });
      } catch (error) {
        console.log('Could not query code shares:', error);
      }
      
      // Calculate collaboration score (0-10)
      const collaborationScore = Math.min(10, Math.round((totalShares / 3)));
      
      // Get time patterns
      const timePatterns = {};
      
      return {
        languageFrequency,
        collaborationScore,
        totalShares,
        timePatterns,
        languages: Object.keys(languageFrequency)
      };
    } catch (error) {
      console.error('Error analyzing code sharing patterns:', error);
      return { languageFrequency: {}, collaborationScore: 0 };
    }
  }

  // Helper function to get recent code snippets
  async getRecentCodeSnippets() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return [];
      
      // Get from local storage (CodeSnippetService)
      const snippetsData = await AsyncStorage.getItem('codeSnippets');
      const snippets = snippetsData ? JSON.parse(snippetsData) : {};
      
      // Convert to array and sort by date
      const snippetArray = Object.values(snippets)
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
        .slice(0, 10);
      
      // Extract topics from snippets
      return snippetArray.map(snippet => ({
        id: snippet.id,
        language: snippet.language,
        topic: snippet.title,
        lastModified: snippet.lastModified
      }));
    } catch (error) {
      console.error('Error getting recent snippets:', error);
      return [];
    }
  }

  // Helper function for RAG-based recent interactions analysis
  async analyzeRecentInteractions() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return { activeChats: 0, codeSnippetsShared: 0 };
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Get recent chats
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId)
      );
      
      const chatsSnapshot = await getDocs(chatsQuery);
      let activeChats = 0;
      let codeSnippetsShared = 0;
      let messageCount = 0;
      
      // Analyze each chat
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const lastMessageTime = new Date(chatData.lastMessageTime || 0);
        
        if (lastMessageTime > oneWeekAgo) {
          activeChats++;
          
          // Count code snippets in recent messages
          const messagesQuery = query(
            collection(db, 'chats', chatDoc.id, 'messages'),
            where('senderId', '==', userId),
            where('type', '==', 'code_snippet')
          );
          
          try {
            const messagesSnapshot = await getDocs(messagesQuery);
            codeSnippetsShared += messagesSnapshot.size;
          } catch (error) {
            console.log('Could not query messages:', error);
          }
        }
      }
      
      // Get story interactions
      const storiesQuery = query(
        collection(db, 'stories'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      let storyEngagement = 0;
      try {
        const storiesSnapshot = await getDocs(storiesQuery);
        storiesSnapshot.forEach(doc => {
          const story = doc.data();
          storyEngagement += (story.views || 0) + (story.likes || 0);
        });
      } catch (error) {
        console.log('Could not query stories:', error);
      }
      
      return {
        activeChats,
        codeSnippetsShared,
        messageCount,
        storyEngagement,
        weeklyActivity: activeChats > 5 ? 'high' : activeChats > 2 ? 'moderate' : 'low'
      };
    } catch (error) {
      console.error('Error analyzing recent interactions:', error);
      return { activeChats: 0, codeSnippetsShared: 0 };
    }
  }
}

export default new OpenAIService();