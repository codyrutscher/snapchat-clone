import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { WebView } from 'react-native-webview';
import VirtualFileSystem from '../services/VirtualFileSystem';
import CodeAIService from '../services/CodeAIService';
import AppDeployService from '../services/AppStoreService';
import Terminal from '../components/Terminal';
import TerminalService from '../services/TerminalService';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CodeEditorScreen({ navigation, route }) {
  // Check if we're opening a shared snippet
  const sharedSnippet = route?.params?.sharedSnippet;
  
  // Project state
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  
  // File state
  const [currentFile, setCurrentFile] = useState('src/App.js');
  const [fileContent, setFileContent] = useState('');
  const [openFiles, setOpenFiles] = useState(['src/App.js']);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  
  // Editor state
  const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // AI state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [showInlineAI, setShowInlineAI] = useState(false);
  const [inlineAIPrompt, setInlineAIPrompt] = useState('');
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  // Deployment state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploymentDescription, setDeploymentDescription] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState('');
  
  // Sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAsStory, setShareAsStory] = useState(false);
  const [shareDescription, setShareDescription] = useState('');
  
  // UI state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const editorRef = useRef(null);
  const autoSaveTimeout = useRef(null);

  useEffect(() => {
    initializeFileSystem();
  }, []);

  useEffect(() => {
    // Handle shared snippet
    if (sharedSnippet) {
      handleSharedSnippet();
    }
  }, [sharedSnippet]);

  useEffect(() => {
    if (currentProject && currentFile) {
      const file = currentProject.files[currentFile];
      if (file) {
        setFileContent(file.content || '');
      }
    }
  }, [currentProject, currentFile]);

  useEffect(() => {
    // Auto-save functionality
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    
    if (unsavedChanges) {
      autoSaveTimeout.current = setTimeout(() => {
        saveCurrentFile();
      }, 2000); // Auto-save after 2 seconds of inactivity
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [fileContent, unsavedChanges]);

  const handleSharedSnippet = async () => {
    if (!sharedSnippet) return;
    
    // Create a new file for the shared snippet
    if (currentProject) {
      const fileName = `src/shared/${sharedSnippet.title || 'snippet'}.${sharedSnippet.language || 'js'}`;
      await VirtualFileSystem.saveFile(currentProject.id, fileName, sharedSnippet.code);
      setCurrentFile(fileName);
      setOpenFiles([...openFiles, fileName]);
      
      Alert.alert(
        'Code Snippet Imported',
        `The shared code has been added to your project as ${fileName}`
      );
    }
  };

  const initializeFileSystem = async () => {
    await VirtualFileSystem.initialize();
    const allProjects = await VirtualFileSystem.getAllProjects();
    setProjects(allProjects);
    
    if (allProjects.length === 0) {
      // Create a default project if none exists
      const defaultProject = await VirtualFileSystem.createProject('My First App', 'react');
      setCurrentProject(defaultProject);
      setProjects([defaultProject]);
    } else {
      setCurrentProject(allProjects[0]);
    }
  };

  const createNewProject = async () => {
    if (!newProjectName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }

    try {
      setGenerating(true);
      
      // Create the project with React template
      const project = await VirtualFileSystem.createProject(newProjectName.trim(), 'react');
      
      // Update state
      setCurrentProject(project);
      setProjects([...projects, project]);
      
      // Set the main file
      setCurrentFile('src/App.js');
      setOpenFiles(['src/App.js']);
      
      // Reset modal state
      setNewProjectName('');
      setShowNewProjectModal(false);
      
      Alert.alert('Success', `Created React project: ${newProjectName}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create project: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Error', 'Please describe what you want to build');
      return;
    }

    setAILoading(true);
    try {
      const result = await CodeAIService.generateReactApp(aiPrompt, currentProject?.files);
      
      // Create new project with generated files
      const project = await VirtualFileSystem.createProject(
        result.projectName || 'AI Generated App',
        'react'
      );
      
      // Clear default files first (except package.json)
      const defaultFiles = Object.keys(project.files);
      for (const filePath of defaultFiles) {
        if (filePath !== 'package.json') {
          delete project.files[filePath];
        }
      }
      
      // Save all generated files with proper folder structure
      for (const [filePath, content] of Object.entries(result.files)) {
        // Ensure the file path starts with src/ if it's a source file
        const normalizedPath = filePath.startsWith('src/') || filePath.includes('.json') || filePath === 'README.md' 
          ? filePath 
          : `src/${filePath}`;
          
        await VirtualFileSystem.saveFile(project.id, normalizedPath, content);
      }
      
      // Add dependencies
      if (result.dependencies) {
        for (const dep of result.dependencies) {
          await VirtualFileSystem.installPackage(project.id, dep);
        }
      }
      
      // Update project with generated content
      const updatedProject = await VirtualFileSystem.getProject(project.id);
      setCurrentProject(updatedProject);
      setProjects([...projects, updatedProject]);
      
      // Open the main App.js file
      const mainFile = 'src/App.js';
      setCurrentFile(mainFile);
      setOpenFiles([mainFile]);
      
      // Show instructions if provided
      if (result.instructions) {
        Alert.alert('App Generated!', result.instructions);
      } else {
        Alert.alert('Success', `Generated: ${result.description || result.projectName}`);
      }
      
      setShowAIPanel(false);
      setAIPrompt('');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate app: ' + error.message);
    } finally {
      setAILoading(false);
    }
  };

  const handleInlineAI = async () => {
    if (!inlineAIPrompt.trim()) return;

    setAILoading(true);
    try {
      // Check if the prompt is asking to add features/components
      const isAddingFeature = inlineAIPrompt.toLowerCase().includes('add') || 
                             inlineAIPrompt.toLowerCase().includes('create') ||
                             inlineAIPrompt.toLowerCase().includes('new');
      
      if (isAddingFeature && currentProject) {
        // Use the add feature functionality
        const result = await CodeAIService.addFeature({
          projectFiles: currentProject.files,
          featureDescription: inlineAIPrompt
        });
        
        // Handle modified files
        if (result.modifiedFiles) {
          for (const [filePath, content] of Object.entries(result.modifiedFiles)) {
            await VirtualFileSystem.saveFile(currentProject.id, filePath, content);
          }
        }
        
        // Handle new files
        if (result.newFiles) {
          for (const [filePath, content] of Object.entries(result.newFiles)) {
            await VirtualFileSystem.saveFile(currentProject.id, filePath, content);
            // Add to open files if it's a new component
            if (!openFiles.includes(filePath)) {
              setOpenFiles([...openFiles, filePath]);
            }
          }
        }
        
        // Handle new dependencies
        if (result.dependencies) {
          for (const dep of result.dependencies) {
            await VirtualFileSystem.installPackage(currentProject.id, dep);
          }
        }
        
        // Refresh project
        const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
        setCurrentProject(updatedProject);
        
        // Show what was added
        if (result.explanation) {
          Alert.alert('Feature Added', result.explanation);
        }
        
        // If new files were created, switch to the first one
        if (result.newFiles && Object.keys(result.newFiles).length > 0) {
          const firstNewFile = Object.keys(result.newFiles)[0];
          setCurrentFile(firstNewFile);
        }
      } else {
        // Just modify the current file
        const modifiedCode = await CodeAIService.modifyCode({
          code: fileContent,
          instruction: inlineAIPrompt,
          filePath: currentFile
        });
        
        setFileContent(modifiedCode);
        setUnsavedChanges(true);
      }
      
      setShowInlineAI(false);
      setInlineAIPrompt('');
    } catch (error) {
      Alert.alert('Error', 'Failed to apply AI changes: ' + error.message);
    } finally {
      setAILoading(false);
    }
  };

  const saveCurrentFile = async (content = fileContent) => {
    if (currentProject && currentFile) {
      await VirtualFileSystem.saveFile(currentProject.id, currentFile, content);
      const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
      setCurrentProject(updatedProject);
      setUnsavedChanges(false);
    }
  };

  const handleFileSelect = (filePath) => {
    // Save current file before switching
    if (unsavedChanges) {
      saveCurrentFile();
    }
    
    setCurrentFile(filePath);
    if (!openFiles.includes(filePath)) {
      setOpenFiles([...openFiles, filePath]);
    }
    setShowFileExplorer(false);
  };

  const closeFile = (filePath) => {
    const newOpenFiles = openFiles.filter(f => f !== filePath);
    setOpenFiles(newOpenFiles);
    
    if (currentFile === filePath && newOpenFiles.length > 0) {
      setCurrentFile(newOpenFiles[0]);
    }
  };

  // Replace the generatePreview function in CodeEditorScreen.js with this version:

const generatePreview = async () => {
  if (!currentProject) {
    Alert.alert('Error', 'No project selected');
    return;
  }

  setPreviewLoading(true);
  setPreviewError(null);
  
  try {
    // Save any unsaved changes first
    if (unsavedChanges) {
      await saveCurrentFile();
    }
    
    // Generate the HTML locally
    const html = generateLocalPreviewHtml(currentProject);
    
    // For WebView, we need to use the html source directly, not a data URL
    setPreviewHtml(html);
    setShowPreview(true);
    
  } catch (error) {
    console.error('Preview generation error:', error);
    setPreviewError(error.message);
    Alert.alert('Preview Error', 'Failed to generate preview: ' + error.message);
  } finally {
    setPreviewLoading(false);
  }
};

// Add this helper function after generatePreview:
const generateLocalPreviewHtml = (project) => {
  // Get all JavaScript content
  let jsContent = '';
  
  // Process components and utilities first
  Object.entries(project.files).forEach(([filePath, file]) => {
    if (filePath.endsWith('.js') && filePath !== 'src/App.js') {
      const content = file.content || '';
      // Remove imports and exports
      const cleanContent = content
        .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
        .replace(/export\s+(default\s+)?/g, '');
      
      jsContent += `\n// ${filePath}\n${cleanContent}\n`;
    }
  });
  
  // Add App.js last
  const appContent = project.files['src/App.js']?.content || 'function App() { return React.createElement("div", null, "Hello World"); }';
  const cleanAppContent = appContent
    .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
    .replace(/export\s+(default\s+)?/g, '');
  
  jsContent += `\n// src/App.js\n${cleanAppContent}\n`;
  
  // Get all CSS
  let cssContent = '';
  Object.entries(project.files).forEach(([filePath, file]) => {
    if (filePath.endsWith('.css')) {
      cssContent += `\n/* ${filePath} */\n${file.content || ''}\n`;
    }
  });
  
  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        #root {
            min-height: 100vh;
        }
        #error-display {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            display: none;
        }
        ${cssContent}
    </style>
</head>
<body>
    <div id="root"></div>
    <div id="error-display"></div>
    <script type="text/babel">
        // Error handling
        window.addEventListener('error', function(e) {
            const errorDisplay = document.getElementById('error-display');
            errorDisplay.style.display = 'block';
            errorDisplay.textContent = e.message + ' (Line: ' + e.lineno + ')';
        });
        
        try {
            ${jsContent}
            
            // Check if App is defined
            if (typeof App === 'undefined') {
                throw new Error('App component is not defined. Make sure App.js exports a component.');
            }
            
            // Render the app
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(App));
        } catch (error) {
            const errorDisplay = document.getElementById('error-display');
            errorDisplay.style.display = 'block';
            errorDisplay.textContent = 'Error: ' + error.message;
        }
    </script>
</body>
</html>`;
};

  const deployProject = async () => {
    if (!currentProject) return;
    
    setDeploying(true);
    try {
      const result = await AppDeployService.deployApp(currentProject);
      setDeployedUrl(result.url);
      
      Alert.alert(
        'App Deployed Successfully!',
        'Your app is now live and can be shared with anyone!',
        [
          { text: 'Share', onPress: () => shareDeployedApp(result.url) },
          { text: 'OK' }
        ]
      );
      
      setShowDeployModal(false);
    } catch (error) {
      Alert.alert('Deployment Failed', error.message);
    } finally {
      setDeploying(false);
    }
  };

  const shareAsAppStory = async () => {
    if (!currentProject) return;
    
    try {
      await AppDeployService.shareAsStory(currentProject, shareDescription);
      Alert.alert('Success', 'Your app has been shared as a story!');
      setShowShareModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to share as story');
    }
  };

  const shareDeployedApp = async (url) => {
    try {
      await Share.share({
        message: `Check out my app built with DevChat: ${url}`,
        url: url,
        title: currentProject.name
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share app');
    }
  };

  const shareCodeSnippet = async () => {
    if (!currentFile || !fileContent) return;
    
    navigation.navigate('Camera', {
      codeSnippet: {
        code: fileContent,
        language: getFileLanguage(currentFile),
        title: currentFile.split('/').pop(),
        description: `${fileContent.split('\n').length} lines of code`
      }
    });
  };

  const forkExistingApp = async (appId) => {
    try {
      const forkedProject = await AppDeployService.forkApp(appId);
      setCurrentProject(forkedProject);
      setProjects([...projects, forkedProject]);
      Alert.alert('Success', 'App forked successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to fork app');
    }
  };

  const renderFileExplorer = () => {
    if (!currentProject) return null;
    
    const files = Object.keys(currentProject.files);
    const fileTree = {};
    
    // Build file tree structure
    files.forEach(filePath => {
      const parts = filePath.split('/');
      let current = fileTree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = filePath;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });

    return (
      <View style={styles.fileExplorer}>
        <View style={styles.fileExplorerHeader}>
          <Text style={styles.fileExplorerTitle}>Files</Text>
          <View style={styles.fileActions}>
            <TouchableOpacity onPress={() => setShowNewFolderModal(true)} style={styles.fileActionButton}>
              <Ionicons name="folder-open" size={20} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => createNewFile()} style={styles.fileActionButton}>
              <Ionicons name="add" size={20} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFileExplorer(false)}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView>
          {renderFileTree(fileTree)}
        </ScrollView>
      </View>
    );
  };

  const createNewFile = () => {
    setShowNewFileModal(true);
  };

  const createFileWithPath = async (filePath) => {
    if (!currentProject || !filePath.trim()) return;
    
    try {
      await VirtualFileSystem.createFile(currentProject.id, filePath.trim());
      const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
      setCurrentProject(updatedProject);
      handleFileSelect(filePath.trim());
      setNewFileName('');
      setShowNewFileModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create file: ' + error.message);
    }
  };

  const createFolder = async () => {
    if (!currentProject || !newFolderName.trim()) return;
    
    try {
      // Create a placeholder file in the folder to ensure it exists
      const placeholderPath = `${newFolderName.trim()}/.gitkeep`;
      await VirtualFileSystem.createFile(currentProject.id, placeholderPath);
      const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
      setCurrentProject(updatedProject);
      setNewFolderName('');
      setShowNewFolderModal(false);
      Alert.alert('Success', `Created folder: ${newFolderName}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create folder: ' + error.message);
    }
  };

  const renderFileTree = (tree, level = 0) => {
    return Object.entries(tree).map(([name, value]) => {
      const isFile = typeof value === 'string';
      const icon = isFile ? getFileIcon(name) : 'folder';
      
      return (
        <View key={name}>
          <TouchableOpacity
            style={[styles.fileItem, { paddingLeft: 20 + level * 20 }]}
            onPress={() => isFile && handleFileSelect(value)}
          >
            <Ionicons name={icon} size={16} color={Colors.primary} />
            <Text style={[styles.fileName, currentFile === value && styles.activeFileName]}>
              {name}
            </Text>
            {currentFile === value && unsavedChanges && (
              <Text style={styles.unsavedIndicator}>●</Text>
            )}
          </TouchableOpacity>
          {!isFile && renderFileTree(value, level + 1)}
        </View>
      );
    });
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop();
    const iconMap = {
      'js': 'logo-javascript',
      'jsx': 'logo-react',
      'css': 'color-palette',
      'json': 'code-slash',
      'html': 'globe',
      'md': 'document-text',
      'gitkeep': 'git-branch'
    };
    return iconMap[extension] || 'document';
  };

  const getFileLanguage = (filename) => {
    const extension = filename.split('.').pop();
    return extension || 'javascript';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowProjectSelector(true)}>
          <Text style={styles.projectName}>
            {currentProject?.name || 'No Project'} ▼
          </Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={generatePreview} style={styles.headerButton}>
            <Ionicons name="play" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDeployModal(true)} style={styles.headerButton}>
            <Ionicons name="cloud-upload" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowShareModal(true)} style={styles.headerButton}>
            <Ionicons name="share" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAIPanel(true)} style={styles.headerButton}>
            <Ionicons name="sparkles" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFileExplorer(true)} style={styles.headerButton}>
            <Ionicons name="folder" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTerminal(!showTerminal)} style={styles.headerButton}>
            <Ionicons name="terminal" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* File Tabs */}
      <ScrollView horizontal style={styles.tabBar} showsHorizontalScrollIndicator={false}>
        {openFiles.map(file => (
          <View key={file} style={[styles.tab, currentFile === file && styles.activeTab]}>
            <TouchableOpacity onPress={() => setCurrentFile(file)}>
              <Text style={[styles.tabText, currentFile === file && styles.activeTabText]}>
                {file.split('/').pop()}
                {currentFile === file && unsavedChanges && <Text> •</Text>}
              </Text>
            </TouchableOpacity>
            {openFiles.length > 1 && (
              <TouchableOpacity onPress={() => closeFile(file)} style={styles.closeTab}>
                <Ionicons name="close" size={14} color={Colors.gray} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Code Editor */}
      <View style={[styles.editorContainer, showTerminal && styles.editorWithTerminal]}>
        <ScrollView style={styles.editor}>
          <View style={styles.editorContent}>
            {showLineNumbers && (
              <View style={styles.lineNumbers}>
                {fileContent.split('\n').map((_, index) => (
                  <Text key={index} style={styles.lineNumber}>
                    {index + 1}
                  </Text>
                ))}
              </View>
            )}
            <TextInput
              ref={editorRef}
              style={styles.codeInput}
              value={fileContent}
              onChangeText={(text) => {
                setFileContent(text);
                setUnsavedChanges(true);
              }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              placeholder="Start coding..."
              placeholderTextColor={Colors.gray}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </View>

      {/* Terminal */}
      {showTerminal && (
        <View style={[styles.terminalContainer, { height: terminalHeight }]}>
          <Terminal 
            project={currentProject}
            onCreateFile={(filePath) => createFileWithPath(filePath)}
            onDeleteFile={async (filePath) => {
              if (!currentProject) return;
              await VirtualFileSystem.deleteFile(currentProject.id, filePath);
              const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
              setCurrentProject(updatedProject);
              // Remove from open files if it's open
              setOpenFiles(openFiles.filter(f => f !== filePath));
              if (currentFile === filePath) {
                setCurrentFile(openFiles[0] || 'src/App.js');
              }
            }}
          />
        </View>
      )}

      {/* Inline AI Bar */}
      {!showTerminal && (
        <TouchableOpacity 
          style={styles.inlineAIButton}
          onPress={() => setShowInlineAI(true)}
        >
          <Ionicons name="sparkles" size={20} color={Colors.primary} />
          <Text style={styles.inlineAIText}>AI Edit (Cmd+K)</Text>
        </TouchableOpacity>
      )}

      {/* File Explorer Modal */}
      {showFileExplorer && renderFileExplorer()}

      {/* AI Panel Modal */}
      <Modal
        visible={showAIPanel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIPanel(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.aiPanel}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiTitle}>AI App Generator</Text>
              <TouchableOpacity onPress={() => setShowAIPanel(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.aiLabel}>Describe your app:</Text>
            <TextInput
              style={styles.aiInput}
              placeholder="Create a todo app with categories, filters, and local storage. Add components for TodoList, TodoItem, and CategoryFilter..."
              placeholderTextColor={Colors.gray}
              value={aiPrompt}
              onChangeText={setAIPrompt}
              multiline
              numberOfLines={4}
            />
            
            <TouchableOpacity
              style={[styles.generateButton, aiLoading && styles.disabledButton]}
              onPress={handleAIGenerate}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={Colors.white} />
                  <Text style={styles.generateText}>Generate App</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Deploy Modal */}
      <Modal
        visible={showDeployModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeployModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.deployModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deploy App</Text>
              <TouchableOpacity onPress={() => setShowDeployModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.deployInfo}>
              Deploy your app to the cloud and get a shareable link!
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="App description (optional)"
              placeholderTextColor={Colors.gray}
              value={deploymentDescription}
              onChangeText={setDeploymentDescription}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity
              style={[styles.deployButton, deploying && styles.disabledButton]}
              onPress={deployProject}
              disabled={deploying}
            >
              {deploying ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.deployButtonText}>Deploying...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color={Colors.white} />
                  <Text style={styles.deployButtonText}>Deploy Now</Text>
                </>
              )}
            </TouchableOpacity>
            
            {deployedUrl && (
              <View style={styles.deployedInfo}>
                <Text style={styles.deployedLabel}>Your app is live at:</Text>
                <Text style={styles.deployedUrl}>{deployedUrl}</Text>
                <TouchableOpacity
                  style={styles.shareUrlButton}
                  onPress={() => shareDeployedApp(deployedUrl)}
                >
                  <Text style={styles.shareUrlText}>Share Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.shareModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Your App</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.shareOption}
              onPress={shareCodeSnippet}
            >
              <Ionicons name="code-slash" size={24} color={Colors.primary} />
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionTitle}>Share Current File</Text>
                <Text style={styles.shareOptionDesc}>Send as a code snippet to friends</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => {
                setShareAsStory(true);
                shareAsAppStory();
              }}
            >
              <Ionicons name="images" size={24} color={Colors.primary} />
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionTitle}>Share as Story</Text>
                <Text style={styles.shareOptionDesc}>Share your app progress with everyone</Text>
              </View>
            </TouchableOpacity>
            
            {deployedUrl && (
              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => shareDeployedApp(deployedUrl)}
              >
                <Ionicons name="link" size={24} color={Colors.primary} />
                <View style={styles.shareOptionText}>
                  <Text style={styles.shareOptionTitle}>Share Live App</Text>
                  <Text style={styles.shareOptionDesc}>Share the deployed app link</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Inline AI Modal - Fixed */}
      <Modal
        visible={showInlineAI}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowInlineAI(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setShowInlineAI(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
            style={styles.inlineAIModal}
          >
            <TextInput
              style={styles.inlineAIInput}
              placeholder="Add a dark mode toggle, navigation bar, or any feature..."
              placeholderTextColor={Colors.gray}
              value={inlineAIPrompt}
              onChangeText={setInlineAIPrompt}
              autoFocus
              onSubmitEditing={() => {
                if (!aiLoading && inlineAIPrompt.trim()) {
                  handleInlineAI();
                }
              }}
              editable={!aiLoading}
            />
            <TouchableOpacity 
              onPress={() => {
                if (!aiLoading && inlineAIPrompt.trim()) {
                  handleInlineAI();
                }
              }}
              disabled={aiLoading || !inlineAIPrompt.trim()}
              style={styles.inlineAISendButton}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={!inlineAIPrompt.trim() ? Colors.gray : Colors.primary} 
                />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Preview Modal - Simplified */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowPreview(false);
          setPreviewUrl('');
          setPreviewError(null);
        }}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewActions}>
              <TouchableOpacity 
                style={styles.previewActionButton}
                onPress={generatePreview}
              >
                <Ionicons name="refresh" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.previewActionButton}
                onPress={() => {
                  setShowDeployModal(true);
                  setShowPreview(false);
                }}
              >
                <Ionicons name="cloud-upload" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setShowPreview(false);
                  setPreviewUrl('');
                  setPreviewError(null);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.black} />
              </TouchableOpacity>
            </View>
          </View>
          
          {previewLoading && (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.previewLoadingText}>Deploying preview...</Text>
            </View>
          )}
          
          {!previewLoading && previewError && (
            <View style={styles.previewError}>
              <Ionicons name="alert-circle" size={60} color={Colors.danger} />
              <Text style={styles.previewErrorText}>Preview Error</Text>
              <Text style={styles.previewErrorDetail}>{previewError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={generatePreview}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!previewLoading && !previewError && previewUrl && (
            <WebView
              source={{ uri: previewUrl }}
              style={styles.webView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error: ', nativeEvent);
                setPreviewError(nativeEvent.description || 'Failed to load preview');
              }}
            />
          )}
          
          {!previewLoading && !previewError && !previewUrl && (
            <View style={styles.previewError}>
              <Text style={styles.previewErrorText}>No preview available</Text>
              <Text style={styles.previewErrorDetail}>Deploy your app first to see a preview</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => setShowDeployModal(true)}>
                <Text style={styles.retryButtonText}>Deploy Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Project Selector Modal */}
      <Modal
        visible={showProjectSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProjectSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.projectSelector}>
            <Text style={styles.projectSelectorTitle}>My Projects</Text>
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.projectItem}
                  onPress={() => {
                    if (unsavedChanges) {
                      saveCurrentFile();
                    }
                    setCurrentProject(item);
                    setCurrentFile('src/App.js');
                    setOpenFiles(['src/App.js']);
                    setShowProjectSelector(false);
                  }}
                >
                  <View style={styles.projectItemInfo}>
                    <Text style={styles.projectItemName}>{item.name}</Text>
                    <Text style={styles.projectItemDate}>
                      {new Date(item.lastModified).toLocaleDateString()}
                    </Text>
                  </View>
                  {item.id === currentProject?.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.newProjectButton}
              onPress={() => {
                setShowProjectSelector(false);
                setShowNewProjectModal(true);
              }}
            >
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.newProjectText}>New Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Project Modal */}
      <Modal
        visible={showNewProjectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewProjectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.newProjectModal}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.input}
              placeholder="Project name"
              placeholderTextColor={Colors.gray}
              value={newProjectName}
              onChangeText={setNewProjectName}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowNewProjectModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, generating && styles.disabledButton]}
                onPress={createNewProject}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.createText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New File Modal */}
      <Modal
        visible={showNewFileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewFileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.newFileModal}>
            <Text style={styles.modalTitle}>New File</Text>
            <TextInput
              style={styles.input}
              placeholder="src/components/Button.js"
              placeholderTextColor={Colors.gray}
              value={newFileName}
              onChangeText={setNewFileName}
              autoFocus
            />
            <Text style={styles.fileHint}>
              Examples: src/App.js, src/styles.css, package.json
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setNewFileName('');
                  setShowNewFileModal(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => createFileWithPath(newFileName)}
              >
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        visible={showNewFolderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewFolderModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.newFileModal}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.input}
              placeholder="src/components/common"
              placeholderTextColor={Colors.gray}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <Text style={styles.fileHint}>
              Examples: src/components, src/utils, src/pages
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setNewFolderName('');
                  setShowNewFolderModal(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createFolder}
              >
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerButton: {
    padding: 5,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.lightGray,
  },
  activeTab: {
    backgroundColor: Colors.background,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  activeTabText: {
    color: Colors.text,
  },
  closeTab: {
    marginLeft: 10,
    padding: 2,
  },
  editorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  editorWithTerminal: {
    flex: 0.6,
  },
  editor: {
    flex: 1,
  },
  editorContent: {
    flexDirection: 'row',
  },
  lineNumbers: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.lightGray,
  },
  lineNumber: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 10,
    textAlignVertical: 'top',
  },
  terminalContainer: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  inlineAIButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  inlineAIText: {
    color: Colors.primary,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  fileExplorer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: screenWidth * 0.75,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  fileExplorerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  fileExplorerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 15,
  },
  fileActionButton: {
    padding: 5,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 20,
  },
  fileName: {
    marginLeft: 10,
    color: Colors.text,
    fontSize: 14,
  },
  activeFileName: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  unsavedIndicator: {
    color: Colors.warning,
    marginLeft: 5,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  aiPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  aiLabel: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 10,
  },
  aiInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  generateText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deployModal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  deployInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  deployButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 10,
    marginTop: 10,
  },
  deployButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deployedInfo: {
    marginTop: 20,
    padding: 15,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  deployedLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  deployedUrl: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareUrlButton: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  shareUrlText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  shareModal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.background,
    borderRadius: 10,
    marginBottom: 10,
  },
  shareOptionText: {
    marginLeft: 15,
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  shareOptionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inlineAIModal: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  inlineAIInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    marginRight: 10,
  },
  inlineAISendButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  previewActionButton: {
    padding: 5,
  },
  previewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLoadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
  webView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  webViewLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
  closeButton: {
    padding: 5,
  },
  previewError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewErrorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.danger,
    marginTop: 20,
  },
  previewErrorDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  projectSelector: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  projectSelectorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  projectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  projectItemInfo: {
    flex: 1,
  },
  projectItemName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: 'bold',
  },
  projectItemDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  newProjectButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    gap: 10,
  },
  newProjectText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  newProjectModal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  createText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  newFileModal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  fileHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 5,
    marginBottom: 20,
  },
  warning: {
    color: '#FFA500',
  },
  danger: {
    color: '#FF0000',
  },
});