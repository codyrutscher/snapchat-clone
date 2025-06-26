import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config';

class CodeAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }

  async generateSnippet(prompt, language = 'javascript', userContext = {}) {
    try {
      // Get user's code patterns and preferences for RAG
      const userPatterns = await this.getUserCodePatterns();
      const friendPatterns = await this.getFriendCodePatterns();
      
      const systemPrompt = `You are an expert ${language} developer who understands the user's coding style and preferences.

User Context:
- Preferred languages: ${userPatterns.languages.join(', ')}
- Coding style: ${userPatterns.style}
- Common patterns: ${userPatterns.patterns.join(', ')}
- Friend preferences: ${friendPatterns.popularLanguages.join(', ')}

Generate clean, well-commented ${language} code that matches the user's style and the prompt.
Return ONLY the code without any markdown formatting or explanations.`;

      const userPrompt = `Generate ${language} code for: ${prompt}

Consider the user's coding patterns and what their friends typically share.
Make the code practical, reusable, and following best practices.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating snippet:', error);
      // Fallback to basic generation
      return this.getDefaultSnippet(language);
    }
  }

  async getUserCodePatterns() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return { languages: ['javascript'], style: 'modern', patterns: [] };
      
      // Get user's recent code shares
      const q = query(
        collection(db, 'codeSharing'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const languages = {};
      const patterns = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        languages[data.language] = (languages[data.language] || 0) + 1;
      });
      
      const topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang);
      
      return {
        languages: topLanguages.length > 0 ? topLanguages : ['javascript'],
        style: 'modern',
        patterns: ['functional', 'async-await', 'hooks']
      };
    } catch (error) {
      console.error('Error getting user patterns:', error);
      return { languages: ['javascript'], style: 'modern', patterns: [] };
    }
  }

  async getFriendCodePatterns() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return { popularLanguages: ['javascript'] };
      
      // Get user's friends
      const userDoc = await getDoc(doc(db, 'users', userId));
      const friends = userDoc.data()?.friends || [];
      
      if (friends.length === 0) return { popularLanguages: ['javascript'] };
      
      // Get friends' recent shares
      const languages = {};
      
      for (const friendId of friends.slice(0, 10)) {
        const q = query(
          collection(db, 'codeSharing'),
          where('userId', '==', friendId),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          const lang = doc.data().language;
          languages[lang] = (languages[lang] || 0) + 1;
        });
      }
      
      const popularLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang)
        .slice(0, 3);
      
      return {
        popularLanguages: popularLanguages.length > 0 ? popularLanguages : ['javascript']
      };
    } catch (error) {
      console.error('Error getting friend patterns:', error);
      return { popularLanguages: ['javascript'] };
    }
  }

  getDefaultSnippet(language) {
    const defaults = {
      javascript: '// JavaScript function\nfunction processData(data) {\n  return data.map(item => ({\n    ...item,\n    processed: true,\n    timestamp: new Date().toISOString()\n  }));\n}',
      python: '# Python function\ndef process_data(data):\n    """Process data and add metadata"""\n    return [{\n        **item,\n        "processed": True,\n        "timestamp": datetime.now().isoformat()\n    } for item in data]',
      java: '// Java method\npublic List<Data> processData(List<Data> dataList) {\n    return dataList.stream()\n        .map(item -> item.withProcessed(true)\n            .withTimestamp(Instant.now()))\n        .collect(Collectors.toList());\n}'
    };
    
    return defaults[language] || `// ${language} code\n// Generated snippet`;
  }

  async generateReactApp(prompt, existingFiles = {}) {
    try {
      const systemPrompt = `You are an expert React developer. Generate a complete, working React application.

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "projectName": "descriptive-name",
  "description": "what the app does",
  "files": {
    "src/App.js": "FULL CODE HERE",
    "src/App.css": "FULL CSS HERE",
    "src/components/ComponentName.js": "FULL COMPONENT CODE",
    "README.md": "FULL README CONTENT"
  }
}

Requirements:
- Use ONLY React.useState, NO external libraries
- Create all necessary files with COMPLETE working code
- Use inline styles or CSS files, no CSS frameworks
- Make it fully functional without any npm packages
- Include proper state management with useState
- Add event handlers and user interactions
- Make the UI look good with custom CSS
- Return the ACTUAL CODE, not placeholders
- Everything should work immediately without setup`;

      const userPrompt = `Create this app: ${prompt}

Example for a todo app, you would return:
{
  "projectName": "todo-app",
  "description": "A simple todo list application",
  "files": {
    "src/App.js": "import React, { useState } from 'react';\\nimport './App.css';\\n\\nfunction App() {\\n  const [todos, setTodos] = useState([]);\\n  const [input, setInput] = useState('');\\n\\n  const addTodo = () => {\\n    if (input.trim()) {\\n      setTodos([...todos, { id: Date.now(), text: input, done: false }]);\\n      setInput('');\\n    }\\n  };\\n\\n  const toggleTodo = (id) => {\\n    setTodos(todos.map(todo => \\n      todo.id === id ? { ...todo, done: !todo.done } : todo\\n    ));\\n  };\\n\\n  const deleteTodo = (id) => {\\n    setTodos(todos.filter(todo => todo.id !== id));\\n  };\\n\\n  return (\\n    <div className=\\"App\\">\\n      <h1>Todo List</h1>\\n      <div className=\\"input-container\\">\\n        <input\\n          type=\\"text\\"\\n          value={input}\\n          onChange={(e) => setInput(e.target.value)}\\n          onKeyPress={(e) => e.key === 'Enter' && addTodo()}\\n          placeholder=\\"Add a new todo...\\"\\n        />\\n        <button onClick={addTodo}>Add</button>\\n      </div>\\n      <ul className=\\"todo-list\\">\\n        {todos.map(todo => (\\n          <li key={todo.id} className={todo.done ? 'done' : ''}>\\n            <span onClick={() => toggleTodo(todo.id)}>{todo.text}</span>\\n            <button onClick={() => deleteTodo(todo.id)}>Delete</button>\\n          </li>\\n        ))}\\n      </ul>\\n    </div>\\n  );\\n}\\n\\nexport default App;",
    "src/App.css": ".App {\\n  max-width: 600px;\\n  margin: 0 auto;\\n  padding: 20px;\\n}\\n\\nh1 {\\n  text-align: center;\\n  color: #333;\\n}\\n\\n.input-container {\\n  display: flex;\\n  margin-bottom: 20px;\\n}\\n\\ninput {\\n  flex: 1;\\n  padding: 10px;\\n  font-size: 16px;\\n  border: 1px solid #ddd;\\n  border-radius: 4px 0 0 4px;\\n}\\n\\nbutton {\\n  padding: 10px 20px;\\n  font-size: 16px;\\n  background: #007bff;\\n  color: white;\\n  border: none;\\n  border-radius: 0 4px 4px 0;\\n  cursor: pointer;\\n}\\n\\n.todo-list {\\n  list-style: none;\\n  padding: 0;\\n}\\n\\n.todo-list li {\\n  display: flex;\\n  justify-content: space-between;\\n  align-items: center;\\n  padding: 10px;\\n  margin-bottom: 8px;\\n  background: #f8f9fa;\\n  border-radius: 4px;\\n}\\n\\n.todo-list li.done span {\\n  text-decoration: line-through;\\n  color: #6c757d;\\n}\\n\\n.todo-list li span {\\n  cursor: pointer;\\n  flex: 1;\\n}\\n\\n.todo-list li button {\\n  background: #dc3545;\\n  border-radius: 4px;\\n  padding: 5px 10px;\\n  font-size: 14px;\\n}"
  }
}

Remember to return COMPLETE WORKING CODE!`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      // Parse the response manually
      const responseText = completion.choices[0].message.content;
      
      // Extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI');
      }
      
      const response = JSON.parse(jsonMatch[0]);
      return response;
    } catch (error) {
      console.error('Error generating app:', error);
      throw error;
    }
  }

  async modifyCode({ code, instruction, filePath }) {
    try {
      // Determine file type from extension
      const fileExt = filePath.split('.').pop().toLowerCase();
      let expertise = 'programmer';
      
      switch(fileExt) {
        case 'css':
        case 'scss':
        case 'sass':
          expertise = 'CSS/styling expert';
          break;
        case 'html':
          expertise = 'HTML expert';
          break;
        case 'md':
        case 'markdown':
          expertise = 'documentation writer';
          break;
        case 'json':
          expertise = 'JSON configuration expert';
          break;
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
          expertise = 'JavaScript/React developer';
          break;
        case 'py':
          expertise = 'Python developer';
          break;
        default:
          expertise = 'expert programmer';
      }
      
      const systemPrompt = `You are an ${expertise}. Modify the provided ${fileExt} file according to the instruction.
Return ONLY the complete modified code without any explanations, comments about changes, or markdown code blocks.
If the file is empty or new, create appropriate content based on the instruction.
Maintain proper syntax and best practices for ${fileExt} files.`;

      const userPrompt = `File: ${filePath}

Current code:
${code}

Instruction: ${instruction}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      let modifiedCode = completion.choices[0].message.content;
      
      // Clean up the response - remove markdown code blocks if present
      modifiedCode = modifiedCode.replace(/```[\w]*\n/g, '').replace(/```$/g, '');
      
      return modifiedCode.trim();
    } catch (error) {
      console.error('Error modifying code:', error);
      throw error;
    }
  }

  async explainCode(code, selection = null) {
    try {
      const systemPrompt = `You are a helpful programming teacher. Explain the provided code clearly and concisely.
Focus on what the code does, how it works, and any important concepts.
Use simple language that a developer can understand.`;

      const userPrompt = selection 
        ? `Explain this specific code section:\n${selection}`
        : `Explain this code:\n${code}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 500
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error explaining code:', error);
      throw error;
    }
  }

  async generateApp(prompt) {
    // Alias for generateReactApp but for any language
    return this.generateReactApp(prompt);
  }

  async addFeature({ projectFiles, featureDescription }) {
    try {
      const systemPrompt = `You are an expert full-stack developer with FULL understanding of the entire codebase. 
You MUST analyze all existing files to understand the project structure, naming conventions, and how files interact.

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "modifiedFiles": {
    "filePath": "COMPLETE updated code content here"
  },
  "newFiles": {
    "filePath": "COMPLETE CONTENT HERE - NEVER EMPTY!"
  },
  "explanation": "what was added and how to use it"
}

CRITICAL CROSS-FILE RULES:
1. ANALYZE the existing code to understand:
   - What classNames and IDs are used in JSX/HTML/components
   - What components exist and how they're structured
   - Import/export patterns used in the project
   - File organization and naming conventions
   - Current styling approach (CSS, SCSS, styled-components, etc.)
   - Configuration files and their impact
   - Service/utility files and their usage patterns

2. INTEGRATE new code properly:
   - CSS/SCSS files MUST target actual classNames/IDs used in component files
   - New components MUST be imported where they're used
   - New utilities/services MUST be imported by components that need them
   - Follow the EXACT import style already used in the project
   - Maintain consistent naming with existing files
   - Place files in appropriate directories matching project structure
   - Update configuration files if needed (package.json, tsconfig, etc.)

3. PRESERVE existing functionality:
   - When modifying files, keep ALL existing code/imports
   - Only ADD to files, don't remove existing features
   - Ensure new code doesn't break existing code
   - Maintain type safety if using TypeScript

4. COMPLETE content for ALL files:
   - CSS/SCSS: Full styles that match elements in component files
   - Components: Working code with proper imports/exports
   - Utils/Services: Fully functional code with exports
   - Hooks: Proper React hooks with correct dependencies
   - Config files: Valid JSON/YAML/etc structure
   - Type definitions: Complete TypeScript interfaces/types
   - Documentation: Comprehensive MD files`;

      // Get current App.js content to understand imports
      const appJsContent = projectFiles['src/App.js']?.content || '';
      
      // Get ALL file contents for complete context
      const relevantFiles = {};
      Object.entries(projectFiles).forEach(([path, file]) => {
        // Include ALL code-related files for full cross-file understanding
        if (path.match(/\.(js|jsx|ts|tsx|css|scss|sass|less|json|md|yml|yaml|html|xml|txt|env|config|conf)$/i)) {
          relevantFiles[path] = file.content || '';
        }
      });
      
      const userPrompt = `Add this feature to the app: ${featureDescription}

Current project structure and relevant files:

${Object.entries(relevantFiles).map(([path, content]) => 
  `=== ${path} ===\n${content}\n`
).join('\n')}

IMPORTANT: 
- When creating CSS, analyze the classNames and IDs used in JS/JSX files
- When creating components, properly import them in App.js
- When modifying App.js, preserve existing functionality
- Ensure all files work together

Example for "create Testimonials component":
{
  "newFiles": {
    "src/components/Testimonials.js": "import React from 'react';\\nimport './Testimonials.css';\\n\\nfunction Testimonials() {\\n  const testimonials = [\\n    { id: 1, name: 'John Doe', text: 'Great app!' },\\n    { id: 2, name: 'Jane Smith', text: 'Love it!' }\\n  ];\\n\\n  return (\\n    <div className=\\"testimonials\\">\\n      <h2>Testimonials</h2>\\n      {testimonials.map(t => (\\n        <div key={t.id} className=\\"testimonial\\">\\n          <p>\\"{t.text}\\"</p>\\n          <p className=\\"author\\">- {t.name}</p>\\n        </div>\\n      ))}\\n    </div>\\n  );\\n}\\n\\nexport default Testimonials;",
    "src/components/Testimonials.css": ".testimonials {\\n  margin: 40px 0;\\n  padding: 20px;\\n  background: #f5f5f5;\\n  border-radius: 8px;\\n}\\n\\n.testimonials h2 {\\n  text-align: center;\\n  margin-bottom: 20px;\\n}\\n\\n.testimonial {\\n  margin: 15px 0;\\n  padding: 15px;\\n  background: white;\\n  border-radius: 4px;\\n  box-shadow: 0 2px 4px rgba(0,0,0,0.1);\\n}\\n\\n.author {\\n  text-align: right;\\n  font-style: italic;\\n  color: #666;\\n}"
  },
  "modifiedFiles": {
    "src/App.js": "[Full App.js content with: import Testimonials from './components/Testimonials'; added at top and <Testimonials /> added in the JSX]"
  },
  "explanation": "Created Testimonials component with styling and imported it into App.js"
}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });

      const responseText = completion.choices[0].message.content;
      
      // Extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // Ensure the result has the expected structure
      return {
        modifiedFiles: result.modifiedFiles || {},
        newFiles: result.newFiles || {},
        dependencies: result.dependencies || [],
        explanation: result.explanation || 'Feature added successfully'
      };
    } catch (error) {
      console.error('Error adding feature:', error);
      throw error;
    }
  }

  async debugCode({ code, error }) {
    try {
      const systemPrompt = `You are an expert debugger. Analyze the code and error, then provide a fixed version.
Return only the corrected code without explanations or markdown code blocks.`;

      const userPrompt = `Fix this code that has an error:

Code:
${code}

Error: ${error}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      let fixedCode = completion.choices[0].message.content;
      
      // Clean up the response
      fixedCode = fixedCode.replace(/```[\w]*\n/g, '').replace(/```$/g, '');
      
      return fixedCode.trim();
    } catch (error) {
      console.error('Error debugging code:', error);
      throw error;
    }
  }

  async getSuggestions({ code, cursorPosition, filePath }) {
    try {
      const systemPrompt = `You are an AI code assistant. Provide 3-5 intelligent code completion suggestions.
Return each suggestion on a new line, with the most likely completion first.`;

      const lines = code.split('\n');
      const currentLine = lines[cursorPosition.line] || '';
      const prefix = currentLine.substring(0, cursorPosition.column);

      const userPrompt = `File: ${filePath}
Current line prefix: "${prefix}"
Context: ${lines.slice(Math.max(0, cursorPosition.line - 5), cursorPosition.line).join('\n')}

Suggest completions for what comes next.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      });

      // Parse suggestions from response
      return this.parseSuggestions(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  }

  parseSuggestions(response) {
    // Simple parser for suggestions
    const suggestions = [];
    const lines = response.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('```')) {
        suggestions.push({
          label: trimmedLine,
          insertText: trimmedLine
        });
      }
    });

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }
}

export default new CodeAIService();