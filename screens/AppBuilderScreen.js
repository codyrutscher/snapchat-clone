import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import OpenAIService from '../services/OpenAIService';
import { auth, db, storage } from '../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export default function AppBuilderScreen({ navigation }) {
  const [project, setProject] = useState({
    name: 'My App',
    type: 'react', // react, react-native, vue, vanilla
    files: {
      'index.html': '',
      'App.js': '',
      'styles.css': ''
    }
  });
  const [currentFile, setCurrentFile] = useState('App.js');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const APP_TEMPLATES = [
    {
      id: 'todo',
      name: 'Todo App',
      description: 'Simple task management app',
      type: 'react',
      aiPrompt: 'Create a todo app with add, delete, and mark complete functionality'
    },
    {
      id: 'chat',
      name: 'Chat App',
      description: 'Real-time chat application',
      type: 'react',
      aiPrompt: 'Create a chat app with message history and user names'
    },
    {
      id: 'weather',
      name: 'Weather App',
      description: 'Weather forecast application',
      type: 'react',
      aiPrompt: 'Create a weather app that shows current weather and 5-day forecast'
    },
    {
      id: 'game',
      name: 'Simple Game',
      description: 'Interactive browser game',
      type: 'vanilla',
      aiPrompt: 'Create a simple snake game with score tracking'
    },
    {
      id: 'portfolio',
      name: 'Portfolio Site',
      description: 'Personal portfolio website',
      type: 'vanilla',
      aiPrompt: 'Create a modern portfolio website with projects section'
    }
  ];

  const generateFullApp = async () => {
    if (!aiPrompt.trim() && !selectedTemplate) {
      Alert.alert('Error', 'Please describe what app you want to build');
      return;
    }

    setGenerating(true);
    try {
      const prompt = selectedTemplate 
        ? selectedTemplate.aiPrompt 
        : aiPrompt;

      // Generate the complete app structure
      const appStructure = await OpenAIService.generateFullApp({
        prompt: prompt,
        projectType: selectedTemplate?.type || project.type,
        existingFiles: project.files
      });

      setProject({
        ...project,
        files: appStructure.files,
        name: appStructure.name || project.name,
        type: appStructure.type || project.type
      });

      setShowAIModal(false);
      Alert.alert('Success', 'App generated! You can now preview or edit it.');
    } catch (error) {
      console.error('Error generating app:', error);
      Alert.alert('Error', 'Failed to generate app');
    } finally {
      setGenerating(false);
    }
  };

  // In AppBuilderScreen.js
const setupCollaboration = async (projectId) => {
  const projectRef = doc(db, 'projects', projectId);
  
  // Listen for changes
  const unsubscribe = onSnapshot(projectRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      // Update only if changes are from other users
      if (data.lastEditedBy !== auth.currentUser.uid) {
        setProject(data);
      }
    }
  });
  
  return unsubscribe;
};

  const saveAndShareApp = async () => {
    try {
      // Create a bundle of all files
      const appBundle = {
        name: project.name,
        type: project.type,
        files: project.files,
        createdBy: auth.currentUser.uid,
        creatorName: auth.currentUser.displayName || 'Developer',
        timestamp: new Date().toISOString(),
        description: aiPrompt || `A ${project.type} app`,
        downloads: 0,
        likes: 0,
        forks: 0
      };

      // Save to Firestore
      const appRef = await addDoc(collection(db, 'apps'), appBundle);

      // Create preview HTML
      const previewHtml = generatePreviewHtml(project);
      const previewRef = ref(storage, `apps/${appRef.id}/preview.html`);
      await uploadString(previewRef, previewHtml, 'raw');
      const previewUrl = await getDownloadURL(previewRef);

      // Update with preview URL
      await updateDoc(doc(db, 'apps', appRef.id), {
        previewUrl: previewUrl
      });

      Alert.alert(
        'App Published!', 
        'Your app is now available for others to use and fork!',
        [
          { text: 'View in Discover', onPress: () => navigation.navigate('Discover') },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Error sharing app:', error);
      Alert.alert('Error', 'Failed to share app');
    }
  };

  const generatePreviewHtml = (project) => {
    // Generate a standalone HTML file that includes all code
    if (project.type === 'react') {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>${project.name}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${project.files['styles.css'] || ''}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${project.files['App.js'] || ''}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
    } else {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>${project.name}</title>
  <style>${project.files['styles.css'] || ''}</style>
</head>
<body>
  ${project.files['index.html'] || ''}
  <script>${project.files['script.js'] || ''}</script>
</body>
</html>`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TextInput
          style={styles.projectName}
          value={project.name}
          onChangeText={(name) => setProject({ ...project, name })}
          placeholder="App Name"
        />
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowPreview(true)} style={styles.headerButton}>
            <Ionicons name="play" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAIModal(true)} style={styles.headerButton}>
            <Ionicons name="sparkles" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={saveAndShareApp} style={styles.headerButton}>
            <Ionicons name="cloud-upload" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* File Tabs */}
      <ScrollView horizontal style={styles.fileTabs} showsHorizontalScrollIndicator={false}>
        {Object.keys(project.files).map((filename) => (
          <TouchableOpacity
            key={filename}
            style={[styles.fileTab, currentFile === filename && styles.activeTab]}
            onPress={() => setCurrentFile(filename)}
          >
            <Text style={[styles.fileTabText, currentFile === filename && styles.activeTabText]}>
              {filename}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addFileTab} onPress={() => {
          const filename = prompt('Enter filename:');
          if (filename) {
            setProject({
              ...project,
              files: { ...project.files, [filename]: '' }
            });
            setCurrentFile(filename);
          }
        }}>
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Code Editor */}
      <TextInput
        style={styles.codeEditor}
        value={project.files[currentFile] || ''}
        onChangeText={(text) => setProject({
          ...project,
          files: { ...project.files, [currentFile]: text }
        })}
        multiline
        placeholder={`Start coding ${currentFile}...`}
        placeholderTextColor={Colors.gray}
      />

      {/* AI Generation Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>AI App Builder</Text>
            
            {/* Templates */}
            <Text style={styles.sectionTitle}>Choose a template or describe your app:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templates}>
              {APP_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[styles.template, selectedTemplate?.id === template.id && styles.selectedTemplate]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDesc}>{template.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Custom Prompt */}
            <TextInput
              style={styles.aiPromptInput}
              placeholder="Or describe your app idea..."
              placeholderTextColor={Colors.gray}
              value={aiPrompt}
              onChangeText={setAIPrompt}
              multiline
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAIModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.generateButton, generating && styles.disabledButton]}
                onPress={generateFullApp}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.generateText}>Build App</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>App Preview</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Ionicons name="close" size={24} color={Colors.black} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: generatePreviewHtml(project) }}
            style={styles.webView}
          />
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
    fontSize: 18,
    color: Colors.white,
    fontWeight: 'bold',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerButton: {
    padding: 5,
  },
  fileTabs: {
    backgroundColor: Colors.surface,
    maxHeight: 50,
  },
  fileTab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  fileTabText: {
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  addFileTab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  codeEditor: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: 20,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Modal styles...
  // (Include all the modal styles from the previous code)
});