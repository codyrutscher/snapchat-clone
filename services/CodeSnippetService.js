import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import OpenAIService from './OpenAIService';

class CodeSnippetService {
  constructor() {
    this.userCodePatterns = {};
    this.friendInteractions = {};
  }


  // Add to CodeSnippetService.js after the constructor
  
  // Check if user can send code snippet
  async canSendCodeSnippet() {
    if (!auth.currentUser) return false;
    
    try {
      // Check subscription status
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      // If subscribed, always return true
      if (userData?.subscription?.status === 'active') return true;
      
      // Check monthly code snippet count
      const monthlyCodeCount = userData?.monthlyCodeCount || 0;
      return monthlyCodeCount < 20; // 20 code snippets limit for free tier
    } catch (error) {
      console.error('Error checking code snippet limit:', error);
      return false;
    }
  }
  
  // Increment code snippet count
  async incrementCodeSnippetCount() {
    if (!auth.currentUser) return;
    
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      const currentCount = userData?.monthlyCodeCount || 0;
      
      await updateDoc(userRef, {
        monthlyCodeCount: currentCount + 1,
        lastCountReset: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error incrementing code count:', error);
    }
  }
  
  // Get remaining code snippets
  async getRemainingCodeSnippets() {
    if (!auth.currentUser) return 20;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      // If subscribed, return 'Unlimited'
      if (userData?.subscription?.status === 'active') return 'Unlimited';
      
      const monthlyCodeCount = userData?.monthlyCodeCount || 0;
      return Math.max(0, 20 - monthlyCodeCount);
    } catch (error) {
      console.error('Error getting remaining snippets:', error);
      return 20;
    }
  }
  
  // Generate code using OpenAI
  async generateCode({ prompt, language, context }) {
    try {
      const systemPrompt = `You are a code generator for ${language}. Generate clean, well-commented code based on the user's request. If there's existing code context, integrate your response appropriately.`;
      
      let userPrompt = `Generate ${language} code for: ${prompt}`;
      if (context) {
        userPrompt += `\n\nExisting code context:\n${context}\n\nGenerate code that works with the above context.`;
      }

      const response = await OpenAIService.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating code:', error);
      throw error;
    }
  }

  // Track code generation for learning patterns
  async trackCodeGeneration({ prompt, language, generatedCode }) {
    try {
      await addDoc(collection(db, 'codeGenerations'), {
        userId: auth.currentUser.uid,
        prompt,
        language,
        generatedCode,
        timestamp: new Date().toISOString(),
        metadata: {
          codeLength: generatedCode.length,
          lineCount: generatedCode.split('\n').length
        }
      });

      // Update user patterns
      this.updateUserCodePatterns(language);
    } catch (error) {
      console.error('Error tracking generation:', error);
    }
  }

  // Track code sharing between friends
  async trackCodeSharing({ snippetId, language, sharedWith }) {
    try {
      await addDoc(collection(db, 'codeSharing'), {
        userId: auth.currentUser.uid,
        snippetId,
        language,
        sharedWith,
        timestamp: new Date().toISOString()
      });

      // Update friend interaction patterns
      for (const friendId of sharedWith) {
        if (!this.friendInteractions[friendId]) {
          this.friendInteractions[friendId] = {
            languages: {},
            shareCount: 0
          };
        }
        this.friendInteractions[friendId].shareCount++;
        this.friendInteractions[friendId].languages[language] = 
          (this.friendInteractions[friendId].languages[language] || 0) + 1;
      }

      // Update recommendations
      await this.updateRecommendations();
    } catch (error) {
      console.error('Error tracking sharing:', error);
    }
  }

  // Get suggested code snippets based on patterns
  async getSuggestedSnippets() {
    try {
      const suggestions = [];
      
      // Get user's most used languages
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const preferences = userDoc.data()?.preferences || {};
      const primaryLanguages = preferences.primaryLanguages || ['javascript'];
      
      // Get recent shared snippets to learn patterns
      const recentShares = await this.getRecentSharedSnippets();
      
      // Get friend preferences
      const friendLanguages = await this.getFriendLanguages();
      
      // Generate suggestions based on patterns
      for (const language of primaryLanguages.slice(0, 3)) {
        // Common patterns for each language
        const patterns = this.getLanguagePatterns(language, friendLanguages);
        
        for (const pattern of patterns.slice(0, 2)) {
          suggestions.push({
            title: pattern.title,
            code: pattern.code,
            language: language,
            reason: pattern.reason
          });
        }
      }

      // Add trending snippets
      const trending = await this.getTrendingSnippets();
      suggestions.push(...trending.slice(0, 3));

      return suggestions;
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }

  // Get language-specific patterns
  getLanguagePatterns(language, friendLanguages) {
    const patterns = {
      javascript: [
        {
          title: 'React Hook Pattern',
          code: `const useCustomHook = (initialValue) => {
  const [value, setValue] = useState(initialValue);
  
  const updateValue = useCallback((newValue) => {
    setValue(newValue);
  }, []);
  
  return [value, updateValue];
};`,
          reason: 'Popular with your React friends'
        },
        {
          title: 'Async/Await Error Handler',
          code: `const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};`,
          reason: 'Commonly shared pattern'
        }
      ],
      python: [
        {
          title: 'Decorator Pattern',
          code: `def timing_decorator(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.2f}s")
        return result
    return wrapper`,
          reason: 'Python best practice'
        },
        {
          title: 'Context Manager',
          code: `class FileManager:
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode
        
    def __enter__(self):
        self.file = open(self.filename, self.mode)
        return self.file
        
    def __exit__(self, *args):
        self.file.close()`,
          reason: 'Clean resource management'
        }
      ],
      java: [
        {
          title: 'Singleton Pattern',
          code: `public class Singleton {
    private static Singleton instance;
    
    private Singleton() {}
    
    public static synchronized Singleton getInstance() {
        if (instance == null) {
            instance = new Singleton();
        }
        return instance;
    }
}`,
          reason: 'Classic design pattern'
        }
      ]
    };

    return patterns[language] || [
      {
        title: `${language} Template`,
        code: `// ${language} code template`,
        reason: 'Starting template'
      }
    ];
  }

  // Get recent shared snippets
  async getRecentSharedSnippets() {
    try {
      const q = query(
        collection(db, 'codeSharing'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const shares = [];
      snapshot.forEach(doc => shares.push(doc.data()));
      return shares;
    } catch (error) {
      console.error('Error getting recent shares:', error);
      return [];
    }
  }

  // Get languages used by friends
  async getFriendLanguages() {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const friendIds = userDoc.data()?.friends || [];
      
      const languages = {};
      for (const friendId of friendIds.slice(0, 10)) {
        const friendDoc = await getDoc(doc(db, 'users', friendId));
        const friendLangs = friendDoc.data()?.preferences?.primaryLanguages || [];
        
        for (const lang of friendLangs) {
          languages[lang] = (languages[lang] || 0) + 1;
        }
      }
      
      return languages;
    } catch (error) {
      console.error('Error getting friend languages:', error);
      return {};
    }
  }

  // Get trending code snippets
  async getTrendingSnippets() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const q = query(
        collection(db, 'codeSnippets'),
        where('createdAt', '>', oneDayAgo.toISOString()),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const snippets = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        snippets.push({
          title: data.title,
          code: data.code.substring(0, 200) + '...',
          language: data.language,
          reason: `Trending ${data.language} snippet`
        });
      });
      
      return snippets;
    } catch (error) {
      console.error('Error getting trending:', error);
      return [];
    }
  }

  // Update user code patterns
  updateUserCodePatterns(language) {
    if (!this.userCodePatterns[language]) {
      this.userCodePatterns[language] = 0;
    }
    this.userCodePatterns[language]++;
  }

  // Update recommendations based on patterns
  async updateRecommendations() {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        'codePatterns.languages': this.userCodePatterns,
        'codePatterns.friendInteractions': this.friendInteractions,
        'codePatterns.lastUpdated': new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating recommendations:', error);
    }
  }

  // Get fallback suggestions
  getFallbackSuggestions() {
    return [
      {
        title: 'Hello World',
        code: 'console.log("Hello, World!");',
        language: 'javascript',
        reason: 'Classic starter'
      },
      {
        title: 'Array Methods',
        code: 'const filtered = array.filter(item => item.active);',
        language: 'javascript',
        reason: 'Useful pattern'
      }
    ];
  }

  // Analyze code snippet for friend matching
  async analyzeCodeForMatching(code, language) {
    try {
      // Extract patterns and complexity
      const analysis = {
        language,
        complexity: this.calculateComplexity(code),
        patterns: this.extractPatterns(code, language),
        lineCount: code.split('\n').length,
        concepts: this.extractConcepts(code, language)
      };

      return analysis;
    } catch (error) {
      console.error('Error analyzing code:', error);
      return null;
    }
  }

  // Calculate code complexity
  calculateComplexity(code) {
    const lines = code.split('\n').length;
    const brackets = (code.match(/[{}[\]()]/g) || []).length;
    const keywords = (code.match(/\b(if|else|for|while|switch|case|try|catch)\b/g) || []).length;
    
    const complexity = (lines * 0.3) + (brackets * 0.5) + (keywords * 2);
    
    if (complexity < 10) return 'simple';
    if (complexity < 50) return 'moderate';
    return 'complex';
  }

  // Extract code patterns
  extractPatterns(code, language) {
    const patterns = [];
    
    // Check for common patterns
    if (code.includes('async') && code.includes('await')) patterns.push('async-await');
    if (code.includes('useState') || code.includes('useEffect')) patterns.push('react-hooks');
    if (code.includes('class') && code.includes('extends')) patterns.push('oop');
    if (code.includes('=>')) patterns.push('arrow-functions');
    if (code.includes('map') || code.includes('filter') || code.includes('reduce')) patterns.push('functional');
    
    return patterns;
  }

  // Extract programming concepts
  extractConcepts(code, language) {
    const concepts = [];
    
    // Language-agnostic concepts
    if (code.includes('API') || code.includes('fetch') || code.includes('axios')) concepts.push('api-integration');
    if (code.includes('test') || code.includes('expect') || code.includes('assert')) concepts.push('testing');
    if (code.includes('SELECT') || code.includes('INSERT') || code.includes('UPDATE')) concepts.push('database');
    
    return concepts;
  }
}

export default new CodeSnippetService();