import OpenAI from 'openai';
import { OPENAI_API_KEY } from './config';

class CodeAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }

  async generateReactApp(prompt, existingFiles = {}) {
    try {
      const systemPrompt = `You are an expert React developer. Generate a complete, production-ready React application with proper file structure.

IMPORTANT: Return ONLY a valid JSON object with this exact structure, no other text:
{
  "projectName": "descriptive-name",
  "description": "what the app does",
  "files": {
    "src/App.js": "main App component",
    "src/App.css": "app styles",
    "src/components/ComponentName/ComponentName.js": "component code",
    "src/components/ComponentName/ComponentName.css": "component styles",
    "src/pages/PageName/PageName.js": "page component",
    "src/utils/helpers.js": "utility functions",
    "src/services/api.js": "API service layer"
  },
  "dependencies": ["react", "react-dom", "any-other-packages"],
  "instructions": "how to use the app"
}

Requirements:
- Create a proper folder structure with components/, pages/, utils/, services/ as needed
- Each component should be in its own folder with its CSS file
- Use functional components with hooks
- Include proper error handling
- Add loading states where appropriate
- Make components reusable and modular
- Structure the app with proper separation of concerns
- Add comments for complex logic
- Follow React best practices
- Import components properly in App.js`;

      const userPrompt = `Create a React app: ${prompt}`;

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
      const systemPrompt = `You are an expert React developer. Modify the provided code according to the instruction.
Return only the modified code without explanations or markdown code blocks.
Maintain the existing code style and structure.
Ensure the modified code is working and follows best practices.`;

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

  async addFeature({ projectFiles, featureDescription }) {
    try {
      const systemPrompt = `You are an expert React developer. Add the requested feature to the existing React app.

IMPORTANT: Return ONLY a valid JSON object with this exact structure, no other text:
{
  "modifiedFiles": {
    "filePath": "updated code content here"
  },
  "newFiles": {
    "filePath": "new file content here"
  },
  "dependencies": ["new-package-if-needed"],
  "explanation": "what was added and how to use it"
}

When creating new components:
- Put them in appropriate folders (src/components/, src/pages/, etc.)
- Import them properly in files that use them
- Include any necessary CSS files
- Follow React best practices`;

      // Get current App.js content to understand imports
      const appJsContent = projectFiles['src/App.js']?.content || '';
      
      const userPrompt = `Add this feature to the app: ${featureDescription}

Current App.js:
${appJsContent}

Current project files:
${Object.keys(projectFiles).join('\n')}`;

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