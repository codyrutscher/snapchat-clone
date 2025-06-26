import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';

class VirtualFileSystem {
  constructor() {
    this.projects = {};
    this.currentProjectId = null;
  }

  async initialize() {
    try {
      const savedProjects = await AsyncStorage.getItem('devChatProjects');
      if (savedProjects) {
        this.projects = JSON.parse(savedProjects);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  async createProject(name, template = 'react') {
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultFiles = this.getDefaultTemplate(template);
    
    const project = {
      id: projectId,
      name,
      template,
      files: defaultFiles,
      dependencies: this.getDefaultDependencies(template),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      owner: auth.currentUser?.uid
    };

    this.projects[projectId] = project;
    await this.saveProjects();
    
    return project;
  }

  async installPackage(projectId, packageName, version = 'latest') {
  const project = this.projects[projectId];
  if (!project) throw new Error('Project not found');
  
  // Update package.json
  const packageJsonPath = 'package.json';
  const packageJson = JSON.parse(project.files[packageJsonPath]?.content || '{}');
  
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  
  packageJson.dependencies[packageName] = version;
  
  await this.saveFile(projectId, packageJsonPath, JSON.stringify(packageJson, null, 2));
  
  return true;
}

async getInstalledPackages(projectId) {
  const project = this.projects[projectId];
  if (!project) return [];
  
  const packageJsonPath = 'package.json';
  const packageJson = JSON.parse(project.files[packageJsonPath]?.content || '{}');
  
  return Object.entries(packageJson.dependencies || {});
}

  getDefaultTemplate(template) {
    if (template === 'react') {
      return {
        'src/App.js': {
          content: `import React, { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Welcome to DevChat Code!');
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>{message}</h1>
        <button onClick={() => setMessage('Hello from React!')}>
          Click me
        </button>
      </header>
    </div>
  );
}

export default App;`,
          language: 'javascript'
        },
        'src/App.css': {
          content: `.App {
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #282c34;
}

.App-header {
  color: white;
}

button {
  background-color: #61dafb;
  border: none;
  color: #282c34;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 20px;
}

button:hover {
  background-color: #4fa8c5;
}`,
          language: 'css'
        },
        'src/index.js': {
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
          language: 'javascript'
        },
        'src/index.css': {
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`,
          language: 'css'
        },
        'package.json': {
          content: JSON.stringify({
            name: "my-react-app",
            version: "0.1.0",
            private: true,
            dependencies: {
              "react": "^18.2.0",
              "react-dom": "^18.2.0"
            }
          }, null, 2),
          language: 'json'
        }
      };
    }
    
    return {};
  }

  getDefaultDependencies(template) {
    if (template === 'react') {
      return ['react', 'react-dom'];
    }
    return [];
  }

  async saveFile(projectId, filePath, content) {
    if (!this.projects[projectId]) {
      throw new Error('Project not found');
    }

    this.projects[projectId].files[filePath] = {
      content,
      language: this.getFileLanguage(filePath),
      lastModified: new Date().toISOString()
    };

    this.projects[projectId].lastModified = new Date().toISOString();
    await this.saveProjects();
  }

  async deleteFile(projectId, filePath) {
    if (!this.projects[projectId]) {
      throw new Error('Project not found');
    }

    delete this.projects[projectId].files[filePath];
    this.projects[projectId].lastModified = new Date().toISOString();
    await this.saveProjects();
  }

  async createFile(projectId, filePath) {
    const extension = filePath.split('.').pop();
    let defaultContent = '';

    switch (extension) {
      case 'js':
      case 'jsx':
        defaultContent = '// New file\n';
        break;
      case 'css':
        defaultContent = '/* New styles */\n';
        break;
      case 'json':
        defaultContent = '{\n  \n}';
        break;
      default:
        defaultContent = '';
    }

    await this.saveFile(projectId, filePath, defaultContent);
  }

  getFileLanguage(filePath) {
    const extension = filePath.split('.').pop();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'html': 'html',
      'md': 'markdown'
    };
    return languageMap[extension] || 'plaintext';
  }

  async getProject(projectId) {
    return this.projects[projectId];
  }

  async getAllProjects() {
    return Object.values(this.projects);
  }

  async deleteProject(projectId) {
    delete this.projects[projectId];
    await this.saveProjects();
  }

  async saveProjects() {
    try {
      await AsyncStorage.setItem('devChatProjects', JSON.stringify(this.projects));
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  }

  setCurrentProject(projectId) {
    this.currentProjectId = projectId;
  }

  getCurrentProject() {
    return this.projects[this.currentProjectId];
  }
}

export default new VirtualFileSystem();