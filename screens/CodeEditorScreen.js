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
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { WebView } from 'react-native-webview';
import VirtualFileSystem from '../services/VirtualFileSystem';
import CodeAIService from '../services/CodeAIService';
import { auth, db } from '../firebase';
import { collection, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CodeEditorScreen({ navigation, route }) {
  // Project state
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  
  // File state
  const [currentFile, setCurrentFile] = useState('src/App.js');
  const [fileContent, setFileContent] = useState('');
  const [openFiles, setOpenFiles] = useState(['src/App.js']);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  
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
  
  // File management state
  const [newFileType, setNewFileType] = useState('file');
  const [selectedFolder, setSelectedFolder] = useState('');
  
  // Publishing state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishTags, setPublishTags] = useState('');
  
  // Preview state
  
  
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
    // Handle imported app
    if (route?.params?.importApp) {
      handleImportApp();
    }
  }, [route?.params?.importApp]);

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

  const handleImportApp = async () => {
    const { importApp } = route.params;
    
    try {
      // Get the full app data
      const appDoc = await getDoc(doc(db, 'deployedApps', importApp.id));
      if (!appDoc.exists()) {
        Alert.alert('Error', 'App not found');
        return;
      }
      
      const appData = appDoc.data();
      
      // Create a new project with the app's files
      const project = await VirtualFileSystem.createProject(
        `${appData.name} (Copy)`,
        'react'
      );
      
      // Save all files from the app
      if (appData.files) {
        for (const [filePath, fileData] of Object.entries(appData.files)) {
          await VirtualFileSystem.saveFile(project.id, filePath, fileData.content || '');
        }
      }
      
      // Update current project
      setCurrentProject(project);
      setProjects([...projects, project]);
      
      // Open the main file
      setCurrentFile('src/App.js');
      setOpenFiles(['src/App.js']);
      
      // Record fork
      await updateDoc(doc(db, 'deployedApps', importApp.id), {
        forks: (appData.forks || 0) + 1
      });
      
      Alert.alert('Success', `Imported "${appData.name}" to your projects!`);
    } catch (error) {
      console.error('Error importing app:', error);
      Alert.alert('Error', 'Failed to import app');
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
      
      // Create the project as general (not React specific)
      const project = await VirtualFileSystem.createProject(newProjectName.trim(), 'general');
      
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
      
      // Special handling for CSS/style requests
      const isStyleRequest = inlineAIPrompt.toLowerCase().includes('style') || 
                            inlineAIPrompt.toLowerCase().includes('css') ||
                            inlineAIPrompt.toLowerCase().includes('design');
      
      if (isAddingFeature && currentProject && !isStyleRequest) {
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

  const createNewFile = async () => {
    if (!newFileName.trim()) {
      Alert.alert('Error', 'Please enter a file name');
      return;
    }

    if (!currentProject) {
      Alert.alert('Error', 'No project selected');
      return;
    }

    try {
      const fullPath = selectedFolder ? `${selectedFolder}/${newFileName}` : newFileName;
      
      if (newFileType === 'folder') {
        // Create folder by creating a placeholder file in it
        await VirtualFileSystem.createFile(currentProject.id, `${fullPath}/.gitkeep`);
      } else {
        await VirtualFileSystem.createFile(currentProject.id, fullPath);
      }
      
      const updatedProject = await VirtualFileSystem.getProject(currentProject.id);
      setCurrentProject(updatedProject);
      
      if (newFileType === 'file') {
        setCurrentFile(fullPath);
        setOpenFiles([...openFiles, fullPath]);
      }
      
      setNewFileName('');
      setSelectedFolder('');
      setShowNewFileModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to create file: ' + error.message);
    }
  };

  const publishProject = async () => {
    if (!currentProject) return;
    
    setPublishing(true);
    try {
      // Save project to discover section
      const publishData = {
        projectId: currentProject.id,
        name: currentProject.name,
        description: publishDescription || `A React app built with DevChat`,
        tags: publishTags.split(',').map(tag => tag.trim()).filter(Boolean),
        owner: auth.currentUser?.uid || 'anonymous',
        ownerName: auth.currentUser?.displayName || 'Developer',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        fileCount: Object.keys(currentProject.files).length,
        public: true,
        views: 0,
        likes: 0,
        forks: 0,
        files: currentProject.files // Include the actual files
      };
      
      await addDoc(collection(db, 'deployedApps'), publishData);
      
      Alert.alert(
        'App Published!', 
        'Your app is now available in Discover!',
        [
          { text: 'View in Discover', onPress: () => navigation.navigate('Discover', { activeTab: 'code' }) },
          { text: 'OK' }
        ]
      );
      setShowPublishModal(false);
      setPublishDescription('');
      setPublishTags('');
    } catch (error) {
      Alert.alert('Error', 'Failed to publish project: ' + error.message);
    } finally {
      setPublishing(false);
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

 

  // Simple preview without React complexity
 

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
            <TouchableOpacity onPress={() => setShowNewFileModal(true)} style={styles.fileActionButton}>
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
          <TouchableOpacity onPress={() => setShowNewFileModal(true)} style={styles.headerButton}>
            <Ionicons name="add-circle" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPublishModal(true)} style={styles.headerButton}>
            <Ionicons name="earth" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAIPanel(true)} style={styles.headerButton}>
            <Ionicons name="sparkles" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFileExplorer(true)} style={styles.headerButton}>
            <Ionicons name="folder" size={20} color={Colors.white} />
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
      <View style={styles.editorContainer}>
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

      {/* Inline AI Bar */}
      {(
        <TouchableOpacity 
          style={styles.inlineAIButton}
          onPress={() => setShowInlineAI(true)}
        >
          <Ionicons name="sparkles" size={20} color={Colors.primary} />
          <Text style={styles.inlineAIText}>AI Edit (Cmd+K)</Text>
        </TouchableOpacity>
      )}

      {/* File Explorer Modal */}
      <Modal
        visible={showFileExplorer}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFileExplorer(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          activeOpacity={1} 
          onPress={() => setShowFileExplorer(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            {renderFileExplorer()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

      {/* New File/Folder Modal */}
      <Modal
        visible={showNewFileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewFileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create New</Text>
            
            <View style={styles.fileTypeSelector}>
              <TouchableOpacity
                style={[styles.fileTypeOption, newFileType === 'file' && styles.fileTypeActive]}
                onPress={() => setNewFileType('file')}
              >
                <Ionicons name="document" size={20} color={newFileType === 'file' ? Colors.white : Colors.text} />
                <Text style={[styles.fileTypeText, newFileType === 'file' && styles.fileTypeTextActive]}>File</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fileTypeOption, newFileType === 'folder' && styles.fileTypeActive]}
                onPress={() => setNewFileType('folder')}
              >
                <Ionicons name="folder" size={20} color={newFileType === 'folder' ? Colors.white : Colors.text} />
                <Text style={[styles.fileTypeText, newFileType === 'folder' && styles.fileTypeTextActive]}>Folder</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder={newFileType === 'file' ? 'filename.js' : 'folder-name'}
              placeholderTextColor={Colors.gray}
              value={newFileName}
              onChangeText={setNewFileName}
              autoCapitalize="none"
            />
            
            {currentProject && Object.keys(currentProject.files).some(f => f.includes('/')) && (
              <View style={styles.folderSelector}>
                <Text style={styles.inputLabel}>Parent Folder (optional)</Text>
                <ScrollView horizontal style={styles.folderList}>
                  <TouchableOpacity
                    style={[styles.folderOption, !selectedFolder && styles.folderOptionActive]}
                    onPress={() => setSelectedFolder('')}
                  >
                    <Text style={styles.folderOptionText}>Root</Text>
                  </TouchableOpacity>
                  {[...new Set(Object.keys(currentProject.files)
                    .filter(f => f.includes('/'))
                    .map(f => f.substring(0, f.lastIndexOf('/'))))
                  ].map(folder => (
                    <TouchableOpacity
                      key={folder}
                      style={[styles.folderOption, selectedFolder === folder && styles.folderOptionActive]}
                      onPress={() => setSelectedFolder(folder)}
                    >
                      <Text style={styles.folderOptionText}>{folder}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowNewFileModal(false);
                  setNewFileName('');
                  setSelectedFolder('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createNewFile}
              >
                <Text style={styles.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Publish Modal */}
      <Modal
        visible={showPublishModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPublishModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity 
            style={styles.modalContainer} 
            activeOpacity={1} 
            onPress={() => Keyboard.dismiss()}
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Publish to Discover</Text>
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your project..."
              placeholderTextColor={Colors.gray}
              value={publishDescription}
              onChangeText={setPublishDescription}
              multiline
              numberOfLines={4}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Tags (comma separated): javascript, web, game"
              placeholderTextColor={Colors.gray}
              value={publishTags}
              onChangeText={setPublishTags}
              autoCapitalize="none"
            />
            
            <View style={styles.publishInfo}>
              <Ionicons name="information-circle" size={20} color={Colors.gray} />
              <Text style={styles.publishInfoText}>
                Your project will be visible to all users in the Discover section
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPublishModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, publishing && styles.disabledButton]}
                onPress={publishProject}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.createText}>Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Preview Modal */}
     

      {/* Inline AI Modal */}
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

      {/* Project Selector Modal */}
      <Modal
        visible={showProjectSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProjectSelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setShowProjectSelector(false)}
        >
          <TouchableOpacity 
            style={styles.projectSelector}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
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
          </TouchableOpacity>
        </TouchableOpacity>
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
    width: screenWidth * 0.75,
    height: '100%',
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
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
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
  fileTypeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  fileTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  fileTypeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  fileTypeText: {
    color: Colors.text,
    fontWeight: '500',
  },
  fileTypeTextActive: {
    color: Colors.white,
  },
  folderSelector: {
    marginTop: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  folderList: {
    maxHeight: 40,
  },
  folderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  folderOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  folderOptionText: {
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  publishInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 15,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  publishInfoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});