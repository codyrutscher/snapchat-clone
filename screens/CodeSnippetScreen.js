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
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import CodeSnippetService from '../services/CodeSnippetService';
import CodeAIService from '../services/CodeAIService';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CodeSnippetScreen({ navigation, route }) {
  // Check if we're importing a snippet
  const importedSnippet = route?.params?.importedSnippet;
  
  // Snippet state
  const [snippets, setSnippets] = useState([]);
  const [currentSnippet, setCurrentSnippet] = useState(null);
  const [snippetContent, setSnippetContent] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // UI state
  const [showNewSnippetModal, setShowNewSnippetModal] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [languageSelectorContext, setLanguageSelectorContext] = useState(null); // 'newSnippet' or 'aiModal'
  
  // Form state
  const [snippetTitle, setSnippetTitle] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [aiPrompt, setAIPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Share state
  const [shareType, setShareType] = useState('story');
  const [shareDescription, setShareDescription] = useState('');
  
  const editorRef = useRef(null);

  useEffect(() => {
    initializeSnippets();
  }, []);

  useEffect(() => {
    if (importedSnippet) {
      handleImportedSnippet();
    }
  }, [importedSnippet]);

  const initializeSnippets = async () => {
    await CodeSnippetService.initialize();
    const allSnippets = await CodeSnippetService.getAllSnippets();
    setSnippets(allSnippets);
    
    if (allSnippets.length > 0) {
      setCurrentSnippet(allSnippets[0]);
      setSnippetContent(allSnippets[0].content);
    }
  };

  const handleImportedSnippet = async () => {
    try {
      const imported = await CodeSnippetService.importSnippet(importedSnippet.id);
      await initializeSnippets();
      setCurrentSnippet(imported);
      setSnippetContent(imported.content);
      Alert.alert('Success', 'Snippet imported successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to import snippet');
    }
  };

  const createNewSnippet = async () => {
    if (!snippetTitle.trim()) {
      Alert.alert('Error', 'Please enter a snippet title');
      return;
    }

    try {
      const fileType = CodeSnippetService.getFileTypeById(selectedLanguage);
      const snippet = await CodeSnippetService.createSnippet(
        snippetTitle,
        selectedLanguage,
        fileType.defaultContent
      );
      
      setSnippets([snippet, ...snippets]);
      setCurrentSnippet(snippet);
      setSnippetContent(snippet.content);
      setShowNewSnippetModal(false);
      setSnippetTitle('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create snippet');
    }
  };

  const saveCurrentSnippet = async () => {
    if (!currentSnippet) return;
    
    try {
      await CodeSnippetService.updateSnippet(currentSnippet.id, snippetContent);
      setUnsavedChanges(false);
      const updatedSnippets = await CodeSnippetService.getAllSnippets();
      setSnippets(updatedSnippets);
    } catch (error) {
      Alert.alert('Error', 'Failed to save snippet');
    }
  };

  const deleteSnippet = async (snippetId) => {
    Alert.alert(
      'Delete Snippet',
      'Are you sure you want to delete this snippet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CodeSnippetService.deleteSnippet(snippetId);
              const updatedSnippets = await CodeSnippetService.getAllSnippets();
              setSnippets(updatedSnippets);
              
              if (currentSnippet?.id === snippetId) {
                setCurrentSnippet(updatedSnippets[0] || null);
                setSnippetContent(updatedSnippets[0]?.content || '');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete snippet');
            }
          }
        }
      ]
    );
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Error', 'Please describe what code you want to generate');
      return;
    }

    setGenerating(true);
    try {
      const generatedCode = await CodeAIService.generateSnippet(
        aiPrompt,
        selectedLanguage
      );
      
      // Create new snippet with generated code
      const snippet = await CodeSnippetService.createSnippet(
        aiPrompt.substring(0, 50) + '...',
        selectedLanguage,
        generatedCode
      );
      
      setSnippets([snippet, ...snippets]);
      setCurrentSnippet(snippet);
      setSnippetContent(snippet.content);
      setShowAIModal(false);
      setAIPrompt('');
      
      // Track AI generation
      await CodeSnippetService.trackCodeGeneration({
        prompt: aiPrompt,
        language: selectedLanguage,
        generatedCode
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const shareSnippet = async () => {
    if (!currentSnippet) return;
    
    try {
      await CodeSnippetService.shareSnippet(currentSnippet.id, shareType);
      
      Alert.alert(
        'Success',
        `Snippet shared to ${shareType === 'story' ? 'your story' : 'Discover'}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowShareModal(false);
              setShareDescription('');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to share snippet');
    }
  };

  const shareViaChat = async () => {
    if (!currentSnippet) return;
    
    // Navigate to chat list screen with snippet data
    navigation.navigate('Chats', {
      sharedSnippet: {
        id: currentSnippet.id,
        title: currentSnippet.title,
        language: currentSnippet.language,
        content: currentSnippet.content,
        preview: currentSnippet.content.substring(0, 200) + '...'
      }
    });
    
    setShowShareModal(false);
  };

  const openLanguageSelector = (context) => {
    // Close the current modal
    if (context === 'newSnippet') {
      setShowNewSnippetModal(false);
    } else if (context === 'aiModal') {
      setShowAIModal(false);
    }
    
    // Set the context and open language selector after a delay
    setLanguageSelectorContext(context);
    setTimeout(() => {
      setShowLanguageSelector(true);
    }, 100);
  };

  const handleLanguageSelection = (fileType) => {
    setSelectedLanguage(fileType.id);
    setShowLanguageSelector(false);
    
    // Reopen the appropriate modal based on context
    setTimeout(() => {
      if (languageSelectorContext === 'newSnippet') {
        setShowNewSnippetModal(true);
      } else if (languageSelectorContext === 'aiModal') {
        setShowAIModal(true);
      }
      setLanguageSelectorContext(null); // Reset context
    }, 100);
  };

  const closeNewSnippetModal = () => {
    setShowNewSnippetModal(false);
    setSnippetTitle('');
    setShowLanguageSelector(false); // Ensure language selector is closed
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setAIPrompt('');
    setShowLanguageSelector(false); // Ensure language selector is closed
  };

  const renderSnippetItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.snippetItem,
        currentSnippet?.id === item.id && styles.activeSnippet
      ]}
      onPress={() => {
        if (unsavedChanges) {
          saveCurrentSnippet();
        }
        setCurrentSnippet(item);
        setSnippetContent(item.content);
      }}
      onLongPress={() => deleteSnippet(item.id)}
    >
      <Ionicons 
        name={item.fileType.icon} 
        size={20} 
        color={currentSnippet?.id === item.id ? Colors.primary : Colors.gray}
      />
      <View style={styles.snippetInfo}>
        <Text style={[
          styles.snippetTitle,
          currentSnippet?.id === item.id && styles.activeSnippetTitle
        ]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.snippetLanguage}>{item.fileType.name}</Text>
      </View>
      {unsavedChanges && currentSnippet?.id === item.id && (
        <View style={styles.unsavedDot} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Code Snippets</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setShowNewSnippetModal(true)}
            style={styles.headerButton}
          >
            <Ionicons name="add-circle" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowAIModal(true)}
            style={styles.headerButton}
          >
            <Ionicons name="sparkles" size={24} color={Colors.white} />
          </TouchableOpacity>
          {currentSnippet && (
            <TouchableOpacity 
              onPress={() => setShowShareModal(true)}
              style={styles.headerButton}
            >
              <Ionicons name="share-social" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {/* Snippets List */}
        <View style={styles.sidebar}>
          <FlatList
            data={snippets}
            renderItem={renderSnippetItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.snippetsList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No snippets yet</Text>
            }
          />
        </View>

        {/* Editor */}
        <View style={styles.editorContainer}>
          {currentSnippet ? (
            <>
              <View style={styles.editorHeader}>
                <Text style={styles.fileName}>
                  {currentSnippet.title}
                  {currentSnippet.fileType.extension}
                </Text>
                {unsavedChanges && (
                  <TouchableOpacity onPress={saveCurrentSnippet}>
                    <Ionicons name="save" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.editor}>
                <TextInput
                  ref={editorRef}
                  style={styles.codeInput}
                  value={snippetContent}
                  onChangeText={(text) => {
                    setSnippetContent(text);
                    setUnsavedChanges(true);
                  }}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  placeholder="Start coding..."
                  placeholderTextColor={Colors.gray}
                />
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyEditor}>
              <Ionicons name="code-slash" size={60} color={Colors.gray} />
              <Text style={styles.emptyEditorText}>
                Create a new snippet to start coding
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowNewSnippetModal(true)}
              >
                <Ionicons name="add" size={20} color={Colors.white} />
                <Text style={styles.createButtonText}>New Snippet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* New Snippet Modal */}
      <Modal
        visible={showNewSnippetModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeNewSnippetModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Code Snippet</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Snippet title..."
              placeholderTextColor={Colors.gray}
              value={snippetTitle}
              onChangeText={setSnippetTitle}
              autoFocus
            />
            
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => openLanguageSelector('newSnippet')}
            >
              <Ionicons 
                name={CodeSnippetService.getFileTypeById(selectedLanguage).icon} 
                size={24} 
                color={Colors.primary} 
              />
              <Text style={styles.languageSelectorText}>
                {CodeSnippetService.getFileTypeById(selectedLanguage).name}
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.gray} />
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeNewSnippetModal}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={createNewSnippet}
              >
                <Text style={styles.primaryButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Language Selector Modal */}
      <Modal
        visible={showLanguageSelector}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLanguageSelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setShowLanguageSelector(false)}
        >
          <TouchableOpacity 
            style={styles.languageModal}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.languageModalTitle}>Select Language</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CodeSnippetService.getFileTypes().map(fileType => (
                <TouchableOpacity
                  key={fileType.id}
                  style={[
                    styles.languageOption,
                    selectedLanguage === fileType.id && styles.selectedLanguage
                  ]}
                  onPress={() => handleLanguageSelection(fileType)}
                >
                  <Ionicons name={fileType.icon} size={24} color={Colors.primary} />
                  <Text style={styles.languageOptionText}>{fileType.name}</Text>
                  {selectedLanguage === fileType.id && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* AI Generation Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAIModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>AI Code Generator</Text>
            
            <Text style={styles.label}>What would you like to create?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="E.g., Create a function that validates email addresses..."
              placeholderTextColor={Colors.gray}
              value={aiPrompt}
              onChangeText={setAIPrompt}
              multiline
              numberOfLines={4}
            />
            
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => openLanguageSelector('aiModal')}
            >
              <Ionicons 
                name={CodeSnippetService.getFileTypeById(selectedLanguage).icon} 
                size={24} 
                color={Colors.primary} 
              />
              <Text style={styles.languageSelectorText}>
                Generate {CodeSnippetService.getFileTypeById(selectedLanguage).name} code
              </Text>
              <Ionicons name="chevron-down" size={20} color={Colors.gray} />
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeAIModal}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, generating && styles.disabledButton]}
                onPress={handleAIGenerate}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color={Colors.white} />
                    <Text style={styles.primaryButtonText}>Generate</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Share Snippet</Text>
            
            <TouchableOpacity
              style={[styles.shareOption, shareType === 'story' && styles.selectedShareOption]}
              onPress={() => setShareType('story')}
            >
              <Ionicons name="time" size={24} color={Colors.primary} />
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share as Story</Text>
                <Text style={styles.shareOptionDesc}>Visible for 24 hours</Text>
              </View>
              {shareType === 'story' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.shareOption, shareType === 'discover' && styles.selectedShareOption]}
              onPress={() => setShareType('discover')}
            >
              <Ionicons name="earth" size={24} color={Colors.primary} />
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Share to Discover</Text>
                <Text style={styles.shareOptionDesc}>Help others learn from your code</Text>
              </View>
              {shareType === 'discover' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareOption}
              onPress={shareViaChat}
            >
              <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
              <View style={styles.shareOptionInfo}>
                <Text style={styles.shareOptionTitle}>Send via Chat</Text>
                <Text style={styles.shareOptionDesc}>Share with specific friends</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              {shareType !== 'chat' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={shareSnippet}
                >
                  <Text style={styles.primaryButtonText}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
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
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.lightGray,
  },
  snippetsList: {
    padding: 10,
  },
  snippetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 5,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  activeSnippet: {
    backgroundColor: Colors.primary + '20',
  },
  snippetInfo: {
    flex: 1,
    marginLeft: 10,
  },
  snippetTitle: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  activeSnippetTitle: {
    color: Colors.primary,
  },
  snippetLanguage: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.gray,
    marginTop: 20,
  },
  editorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  fileName: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editor: {
    flex: 1,
    padding: 15,
  },
  codeInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyEditor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEditorText: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  languageSelectorText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Colors.text,
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
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  languageModal: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 10,
    maxHeight: '70%',
    width: '80%',
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  selectedLanguage: {
    backgroundColor: Colors.primary + '20',
  },
  languageOptionText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: Colors.text,
  },
  languageModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 15,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  selectedShareOption: {
    backgroundColor: Colors.primary + '20',
  },
  shareOptionInfo: {
    flex: 1,
    marginLeft: 15,
  },
  shareOptionTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  shareOptionDesc: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
});