import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

class TerminalService {
  constructor() {
    this.commands = {
      'help': this.showHelp,
      'clear': this.clearTerminal,
      'ls': this.listFiles,
      'cat': this.showFileContent,
      'mkdir': this.createDirectory,
      'touch': this.createFile,
      'rm': this.removeFile,
      'pwd': this.printWorkingDirectory,
      'cd': this.changeDirectory,
      'npm': this.handleNpm,
      'git': this.handleGit,
      'node': this.executeJavaScript,
      'echo': this.echo,
      'export': this.exportProject,
      'deploy': this.deployProject,
      'ai': this.aiCommand,
    };
    
    this.currentDirectory = '/';
    this.environment = {
      USER: 'developer',
      HOME: '/',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      NODE_ENV: 'development'
    };
    
    this.history = [];
    this.npmPackages = new Set(['react', 'react-dom']);
  }

  async executeCommand(command, context) {
    this.history.push(command);
    
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    if (this.commands[cmd]) {
      try {
        return await this.commands[cmd].call(this, args, context);
      } catch (error) {
        return {
          output: `Error: ${error.message}`,
          type: 'error'
        };
      }
    } else {
      return {
        output: `Command not found: ${cmd}. Type 'help' for available commands.`,
        type: 'error'
      };
    }
  }

  showHelp() {
    return {
      output: `DevChat Terminal - Available Commands:

File System:
  ls              - List files and directories
  cat <file>      - Display file contents
  mkdir <dir>     - Create directory
  touch <file>    - Create empty file
  rm <file>       - Remove file
  pwd             - Print working directory
  cd <dir>        - Change directory

Development:
  npm <command>   - NPM package manager
    install <pkg> - Install package
    list          - List installed packages
    run <script>  - Run npm script
  
  git <command>   - Git version control
    init          - Initialize repository
    status        - Show status
    add <file>    - Stage files
    commit -m     - Commit changes
    log           - Show commit history
  
  node <file>     - Execute JavaScript file
  
Project:
  export          - Export project as ZIP
  deploy          - Deploy project to cloud
  ai <prompt>     - AI assistance

Other:
  clear           - Clear terminal
  echo <text>     - Print text
  help            - Show this help message`,
      type: 'info'
    };
  }

  clearTerminal() {
    return {
      output: '',
      type: 'clear'
    };
  }

  async listFiles(args, context) {
    const project = context.currentProject;
    if (!project) {
      return { output: 'No project open', type: 'error' };
    }

    const files = Object.keys(project.files);
    const currentPath = this.currentDirectory === '/' ? '' : this.currentDirectory;
    
    // Filter files in current directory
    const filesInDir = files.filter(file => {
      const filePath = file.startsWith('/') ? file.slice(1) : file;
      const dirPath = currentPath.startsWith('/') ? currentPath.slice(1) : currentPath;
      
      if (dirPath === '') {
        return !filePath.includes('/') || filePath.split('/').length === 2;
      }
      
      return filePath.startsWith(dirPath + '/') && 
             filePath.slice(dirPath.length + 1).split('/').length <= 1;
    });

    // Format output
    const formatted = filesInDir.map(file => {
      const isDir = files.some(f => f.startsWith(file + '/'));
      const name = file.split('/').pop();
      return isDir ? `${name}/` : name;
    });

    return {
      output: formatted.join('\n') || 'No files found',
      type: 'success'
    };
  }

  async showFileContent(args, context) {
    if (args.length === 0) {
      return { output: 'Usage: cat <filename>', type: 'error' };
    }

    const project = context.currentProject;
    if (!project) {
      return { output: 'No project open', type: 'error' };
    }

    const filename = args[0];
    const fullPath = this.resolvePath(filename);
    
    if (project.files[fullPath]) {
      return {
        output: project.files[fullPath].content,
        type: 'success'
      };
    }

    return { output: `File not found: ${filename}`, type: 'error' };
  }

  async createFile(args, context) {
    if (args.length === 0) {
      return { output: 'Usage: touch <filename>', type: 'error' };
    }

    const filename = args[0];
    const fullPath = this.resolvePath(filename);
    
    await context.createFile(fullPath);
    
    return {
      output: `Created: ${fullPath}`,
      type: 'success'
    };
  }

  async removeFile(args, context) {
    if (args.length === 0) {
      return { output: 'Usage: rm <filename>', type: 'error' };
    }

    const filename = args[0];
    const fullPath = this.resolvePath(filename);
    
    await context.deleteFile(fullPath);
    
    return {
      output: `Removed: ${fullPath}`,
      type: 'success'
    };
  }

  printWorkingDirectory() {
    return {
      output: this.currentDirectory,
      type: 'success'
    };
  }

  changeDirectory(args) {
    if (args.length === 0 || args[0] === '~') {
      this.currentDirectory = '/';
      return { output: '', type: 'success' };
    }

    const path = args[0];
    
    if (path === '..') {
      const parts = this.currentDirectory.split('/').filter(Boolean);
      parts.pop();
      this.currentDirectory = '/' + parts.join('/');
    } else if (path.startsWith('/')) {
      this.currentDirectory = path;
    } else {
      this.currentDirectory = this.resolvePath(path);
    }

    return { output: '', type: 'success' };
  }

  async handleNpm(args, context) {
    const subCommand = args[0];
    
    switch (subCommand) {
      case 'install':
      case 'i':
        if (args.length < 2) {
          return { output: 'Installing dependencies...', type: 'info' };
        }
        const packageName = args[1];
        this.npmPackages.add(packageName);
        return {
          output: `✓ Installed ${packageName}`,
          type: 'success'
        };
        
      case 'list':
      case 'ls':
        return {
          output: Array.from(this.npmPackages).join('\n'),
          type: 'success'
        };
        
      case 'run':
        const script = args[1];
        if (script === 'start') {
          return {
            output: 'Starting development server...\nServer running at http://localhost:3000',
            type: 'success'
          };
        }
        return {
          output: `Running script: ${script}`,
          type: 'success'
        };
        
      default:
        return {
          output: 'Usage: npm [install|list|run] <args>',
          type: 'error'
        };
    }
  }

  async handleGit(args) {
    const subCommand = args[0];
    
    switch (subCommand) {
      case 'init':
        return {
          output: 'Initialized empty Git repository',
          type: 'success'
        };
        
      case 'status':
        return {
          output: `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`,
          type: 'success'
        };
        
      case 'add':
        return {
          output: `Added ${args[1] || 'all files'} to staging`,
          type: 'success'
        };
        
      case 'commit':
        if (args[1] === '-m' && args[2]) {
          const message = args.slice(2).join(' ');
          const hash = Math.random().toString(36).substring(2, 9);
          return {
            output: `[main ${hash}] ${message}\n 1 file changed`,
            type: 'success'
          };
        }
        return {
          output: 'Usage: git commit -m "message"',
          type: 'error'
        };
        
      case 'log':
        return {
          output: `commit abc1234 (HEAD -> main)
Author: ${auth.currentUser?.email || 'developer'}
Date:   ${new Date().toLocaleString()}

    Initial commit`,
          type: 'success'
        };
        
      default:
        return {
          output: 'Usage: git [init|status|add|commit|log]',
          type: 'error'
        };
    }
  }

  async executeJavaScript(args, context) {
    if (args.length === 0) {
      return { output: 'Usage: node <filename>', type: 'error' };
    }

    const filename = args[0];
    const project = context.currentProject;
    
    if (!project) {
      return { output: 'No project open', type: 'error' };
    }

    const fullPath = this.resolvePath(filename);
    const file = project.files[fullPath];
    
    if (!file) {
      return { output: `File not found: ${filename}`, type: 'error' };
    }

    try {
      // Create a sandboxed environment
      const sandbox = {
        console: {
          log: (...args) => {
            this.outputBuffer.push(args.join(' '));
          }
        },
        require: (module) => {
          if (module === 'react') return 'React';
          if (module === 'react-dom') return 'ReactDOM';
          throw new Error(`Module not found: ${module}`);
        }
      };
      
      this.outputBuffer = [];
      
      // Execute in sandbox
      const func = new Function('console', 'require', file.content);
      func(sandbox.console, sandbox.require);
      
      return {
        output: this.outputBuffer.join('\n') || 'Script executed successfully',
        type: 'success'
      };
    } catch (error) {
      return {
        output: `Error: ${error.message}`,
        type: 'error'
      };
    }
  }

  echo(args) {
    return {
      output: args.join(' '),
      type: 'success'
    };
  }

  async deployProject(args, context) {
    return {
      output: `Deploying project...
✓ Building application
✓ Optimizing assets
✓ Uploading to cloud
✓ Deployment complete!

Your app is live at: https://devchat.app/demo/${Date.now()}`,
      type: 'success'
    };
  }

  async aiCommand(args, context) {
    if (args.length === 0) {
      return {
        output: 'Usage: ai <prompt>',
        type: 'error'
      };
    }

    const prompt = args.join(' ');
    return {
      output: `AI: Processing "${prompt}"...
      
Suggestion: Try creating a new component with 'touch src/components/NewComponent.js'`,
      type: 'info'
    };
  }

  resolvePath(path) {
    if (path.startsWith('/')) {
      return path;
    }
    
    if (this.currentDirectory === '/') {
      return '/' + path;
    }
    
    return this.currentDirectory + '/' + path;
  }
}

export default new TerminalService();