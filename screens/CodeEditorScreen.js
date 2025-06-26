import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../firebase';
import { collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import OpenAIService from '../services/OpenAIService';
import SubscriptionService from '../services/SubscriptionService';
import CodeSnippetService from '../services/CodeSnippetService';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extension: '.js' },
  { id: 'python', name: 'Python', extension: '.py' },
  { id: 'java', name: 'Java', extension: '.java' },
  { id: 'typescript', name: 'TypeScript', extension: '.ts' },
  { id: 'react', name: 'React', extension: '.jsx' },
  { id: 'html', name: 'HTML', extension: '.html' },
  { id: 'css', name: 'CSS', extension: '.css' },
  { id: 'sql', name: 'SQL', extension: '.sql' },
  { id: 'go', name: 'Go', extension: '.go' },
  { id: 'rust', name: 'Rust', extension: '.rs' },
];

const CODE_THEMES = [
  { id: 'dark', name: 'Dark', background: '#1e1e1e', text: '#d4d4d4' },
  { id: 'light', name: 'Light', background: '#ffffff', text: '#000000' },
  { id: 'monokai', name: 'Monokai', background: '#272822', text: '#f8f8f2' },
  { id: 'github', name: 'GitHub', background: '#f6f8fa', text: '#24292e' },
];

export default function CodeEditorScreen({ navigation, route }) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('dark');
  const [title, setTitle] = useState('');
  const [sendAsStory, setSendAsStory] = useState(false);
  const [description, setDescription] = useState('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [suggestedSnippets, setSuggestedSnippets] = useState([]);
  const [lineNumbers, setLineNumbers] = useState(['1']);
  const [remainingSnippets, setRemainingSnippets] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const editorRef = useRef(null);

  // If receiving a shared snippet
  useEffect(() => {
    if (route.params?.sharedSnippet) {
      const snippet = route.params.sharedSnippet;
      setCode(snippet.code);
      setLanguage(snippet.language);
      setTitle(snippet.title || '');
      setDescription(snippet.description || '');
    }
  }, [route.params]);

  useEffect(() => {
    loadFriends();
    loadSuggestedSnippets();
  }, []);

  useEffect(() => {
  loadLimitInfo();
}, []);

  useEffect(() => {
    // Update line numbers when code changes
    const lines = code.split('\n');
    setLineNumbers(lines.map((_, index) => String(index + 1)));
  }, [code]);

  const loadFriends = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        
        const friendsData = [];
        for (const friendId of friendIds) {
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            friendsData.push({
              id: friendId,
              ...friendDoc.data()
            });
          }
        }
        setFriends(friendsData);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

const loadLimitInfo = async () => {
  try {
    const remaining = await CodeSnippetService.getRemainingCodeSnippets();
    setRemainingSnippets(remaining);
    
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userDoc.data();
    setIsSubscribed(userData?.subscription?.status === 'active');
  } catch (error) {
    console.error('Error loading limit info:', error);
  }
};

  const loadSuggestedSnippets = async () => {
    try {
      const suggestions = await CodeSnippetService.getSuggestedSnippets();
      setSuggestedSnippets(suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const generateCode = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Error', 'Please enter a description of what you want to generate');
      return;
    }

    setGeneratingCode(true);
    try {
      const generatedCode = await OpenAIService.generateCode({
        prompt: aiPrompt,
        language: language,
        context: code // Include existing code as context
      });

      if (code) {
        // Append to existing code
        setCode(code + '\n\n' + generatedCode);
      } else {
        setCode(generatedCode);
      }

      setAIPrompt('');
      setShowAIModal(false);

      // Track code generation for recommendations
      await CodeSnippetService.trackCodeGeneration({
        prompt: aiPrompt,
        language: language,
        generatedCode: generatedCode
      });
    } catch (error) {
      console.error('Error generating code:', error);
      Alert.alert('Error', 'Failed to generate code');
    } finally {
      setGeneratingCode(false);
    }
  };

  // Update the shareSnippet function in CodeEditorScreen.js
// Replace the shareSnippet function with this:

  const shareSnippet = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please write some code first');
      return;
    }

  if (!sendAsStory && selectedFriends.length === 0) {
    Alert.alert('Error', 'Please select at least one friend to share with');
    return;
  }

    try {
      // Check if user can send code snippet
      const canSend = await CodeSnippetService.canSendCodeSnippet();
      const remaining = await CodeSnippetService.getRemainingCodeSnippets();
      
      if (!canSend) {
        Alert.alert(
          'Code Snippet Limit Reached', 
          'You\'ve reached your monthly limit of 20 code snippets. Upgrade to DevChat Pro for unlimited code sharing!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
          ]
        );
        return;
      }

      // Show remaining count if not unlimited
      if (remaining !== 'Unlimited' && remaining <= 5) {
        Alert.alert(
          'Code Snippets Remaining',
          `You have ${remaining} code snippets left this month. Upgrade to Pro for unlimited sharing!`,
          [
            { text: 'Continue', onPress: () => proceedWithSharing() },
            { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
          ]
        );
      } else {
        proceedWithSharing();
      }
    } catch (error) {
      console.error('Error checking limits:', error);
      proceedWithSharing(); // Proceed anyway if error
    }
  };

  const proceedWithSharing = async () => {
  try {
    if (sendAsStory) {
      // Import SubscriptionService at the top of the file
      const SubscriptionService = require('../services/SubscriptionService').default;
      
      // Check story limit
      const canSendStory = await SubscriptionService.canSendContent('story');
      
      if (!canSendStory) {
        Alert.alert(
          'Story Limit Reached', 
          'You\'ve reached your monthly limit. Upgrade to DevChat Pro for unlimited stories!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
          ]
        );
        return;
      }

      // Create code snippet story
      const storyData = {
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Developer',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'story',
        contentType: 'code', // New field to identify code stories
        code: code,
        language: language,
        title: title || `${language} snippet`,
        description: description,
        metadata: {
          theme: theme,
          linesOfCode: code.split('\n').length,
          characters: code.length
        },
        public: true,
        views: 0,
        likes: 0,
        shares: 0
      };

      await addDoc(collection(db, 'snaps'), storyData);
      await SubscriptionService.incrementContentCount('story');
      
      Alert.alert('Success', 'Code snippet shared as story!', [
        { text: 'OK', onPress: () => {
          setShowShareModal(false);
          // Reset the form
          setCode('');
          setTitle('');
          setDescription('');
          setSelectedFriends([]);
          setSendAsStory(false);
        }}
      ]);
    } else {
      // Original friend sharing logic
      const snippetData = {
        code: code,
        language: language,
        title: title || `${language} snippet`,
        description: description,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Developer',
        createdAt: new Date().toISOString(),
        sharedWith: selectedFriends,
        metadata: {
          theme: theme,
          linesOfCode: code.split('\n').length,
          characters: code.length
        }
      };

      const snippetRef = await addDoc(collection(db, 'codeSnippets'), snippetData);

      // Create messages for friends
      for (const friendId of selectedFriends) {
        const chatId = await findOrCreateChat(friendId);
        
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          type: 'code_snippet',
          snippetId: snippetRef.id,
          snippetData: snippetData,
          text: `Shared a ${language} snippet: ${title || 'Untitled'}`,
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Developer',
          timestamp: new Date().toISOString()
        });

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: `Code snippet: ${title || 'Untitled'}`,
          lastMessageTime: new Date().toISOString()
        });
      }

      await CodeSnippetService.incrementCodeSnippetCount();
      await CodeSnippetService.trackCodeSharing({
        snippetId: snippetRef.id,
        language: language,
        sharedWith: selectedFriends
      });

      Alert.alert('Success', 'Code snippet shared!', [
        { text: 'OK', onPress: () => {
          setShowShareModal(false);
          setSelectedFriends([]);
          // Reset the form
          setCode('');
          setTitle('');
          setDescription('');
          setSendAsStory(false);
        }}
      ]);
    }
  } catch (error) {
    console.error('Error sharing snippet:', error);
    Alert.alert('Error', 'Failed to share snippet');
  }
};

  const findOrCreateChat = async (friendId) => {
    // Check for existing chat
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const snapshot = await getDocs(chatsQuery);
    let existingChatId = null;
    
    snapshot.forEach((doc) => {
      const chat = doc.data();
      if (chat.participants.includes(friendId) && chat.type !== 'group') {
        existingChatId = doc.id;
      }
    });

    if (existingChatId) return existingChatId;

    // Create new chat
    const friendDoc = await getDoc(doc(db, 'users', friendId));
    const friendData = friendDoc.data();
    
    const chatData = {
      participants: [auth.currentUser.uid, friendId],
      participantNames: {
        [auth.currentUser.uid]: auth.currentUser.displayName || 'Developer',
        [friendId]: friendData.username || friendData.displayName || 'Friend'
      },
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      type: 'direct'
    };

    const chatRef = await addDoc(collection(db, 'chats'), chatData);
    return chatRef.id;
  };

  const insertSnippet = (snippet) => {
    if (code) {
      setCode(code + '\n\n' + snippet.code);
    } else {
      setCode(snippet.code);
    }
    setLanguage(snippet.language);
  };

  const copyToClipboard = async () => {
  if (!code.trim()) {
    Alert.alert('Nothing to copy', 'Write some code first');
    return;
  }
  
  try {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', 'Code copied to clipboard');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    // Fallback for web
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        Alert.alert('Copied!', 'Code copied to clipboard');
      }).catch(err => {
        Alert.alert('Error', 'Failed to copy code');
      });
    }
  }
};

  const currentTheme = CODE_THEMES.find(t => t.id === theme);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
          <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Code Editor</Text>
          {remainingSnippets !== null && !isSubscribed && (
            <Text style={styles.limitText}>
              {remainingSnippets} snippets left
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={copyToClipboard} style={styles.headerButton}>
            <Ionicons name="copy-outline" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAIModal(true)} style={styles.headerButton}>
            <Ionicons name="sparkles" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowShareModal(true)} style={styles.headerButton}>
            <Ionicons name="send" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Language Selector */}
      <TouchableOpacity 
        style={styles.languageSelector}
        onPress={() => setShowLanguageModal(true)}
      >
        <Text style={styles.languageText}>
          {LANGUAGES.find(l => l.id === language)?.name || 'JavaScript'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={Colors.white} />
      </TouchableOpacity>

      {/* Code Editor */}
      <View style={[styles.editorContainer, { backgroundColor: currentTheme.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.editorContent}>
            {/* Line Numbers */}
            <View style={styles.lineNumbers}>
              {lineNumbers.map((num, index) => (
                <Text key={index} style={[styles.lineNumber, { color: currentTheme.text + '50' }]}>
                  {num}
                </Text>
              ))}
            </View>
            
            {/* Code Input */}
            <TextInput
              ref={editorRef}
              style={[styles.codeInput, { color: currentTheme.text }]}
              value={code}
              onChangeText={setCode}
              placeholder="// Start coding..."
              placeholderTextColor={currentTheme.text + '50'}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="default"
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>

      {/* Suggested Snippets */}
      {suggestedSnippets.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggested for your friends:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestedSnippets.map((snippet, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => insertSnippet(snippet)}
              >
                <Text style={styles.suggestionText}>{snippet.title}</Text>
                <Text style={styles.suggestionLang}>{snippet.language}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.languageItem}
                  onPress={() => {
                    setLanguage(item.id);
                    setShowLanguageModal(false);
                  }}
                >
                  <Text style={styles.languageName}>{item.name}</Text>
                  <Text style={styles.languageExt}>{item.extension}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* AI Generation Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Code with AI</Text>
            <TextInput
              style={styles.aiPromptInput}
              placeholder="Describe what you want to generate..."
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
                style={[styles.generateButton, generatingCode && styles.disabledButton]}
                onPress={generateCode}
                disabled={generatingCode}
              >
                {generatingCode ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.generateText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
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
          <View style={styles.shareModalContent}>
            <Text style={styles.modalTitle}>Share Code Snippet</Text>
            
            <TextInput
              style={styles.titleInput}
              placeholder="Snippet title (optional)"
              placeholderTextColor={Colors.gray}
              value={title}
              onChangeText={setTitle}
            />
            
            <TextInput
              style={styles.descriptionInput}
              placeholder="Description (optional)"
              placeholderTextColor={Colors.gray}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            
            {/* Story Option */}
            <TouchableOpacity
              style={[styles.storyOption, sendAsStory && styles.storyOptionSelected]}
              onPress={() => setSendAsStory(!sendAsStory)}
            >
              <Ionicons name="images" size={24} color={Colors.primary} />
              <Text style={styles.storyText}>Share as Story</Text>
              {sendAsStory && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
            </TouchableOpacity>
            
            {!sendAsStory && (
              <>
                <Text style={styles.friendsTitle}>Select Friends</Text>
                <FlatList
                  data={friends}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.friendItem,
                        selectedFriends.includes(item.id) && styles.selectedFriend
                      ]}
                      onPress={() => {
                        if (selectedFriends.includes(item.id)) {
                          setSelectedFriends(selectedFriends.filter(id => id !== item.id));
                        } else {
                          setSelectedFriends([...selectedFriends, item.id]);
                        }
                      }}
                    >
                      <Ionicons 
                        name={selectedFriends.includes(item.id) ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={Colors.primary} 
                      />
                      <Text style={styles.friendName}>{item.username || item.displayName}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.friendsList}
                />
              </>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowShareModal(false);
                  setSelectedFriends([]);
                  setSendAsStory(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={shareSnippet}
              >
                <Text style={styles.shareText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerButton: {
    padding: 5,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  languageText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  editorContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  editorContent: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  lineNumbers: {
    paddingHorizontal: 10,
    paddingRight: 5,
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  lineNumber: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  codeInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    paddingHorizontal: 10,
    minWidth: 1000, // Ensure horizontal scrolling works
  },
  suggestionsContainer: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  suggestionsTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  suggestionChip: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  suggestionText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  suggestionLang: {
    color: Colors.primary + '80',
    fontSize: 11,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  shareModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  languageName: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  languageExt: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  aiPromptInput: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    maxHeight: 200,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    minHeight: 80,
    maxHeight: 120,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  friendsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedFriend: {
    backgroundColor: Colors.primary + '20',
  },
  friendName: {
    marginLeft: 10,
    fontSize: 16,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.text,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  generateButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  storyOption: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 15,
  backgroundColor: Colors.primary + '10',
  borderRadius: 10,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: Colors.primary + '30',
},
storyOptionSelected: {
  backgroundColor: Colors.primary + '30',
  borderColor: Colors.primary,
},
storyText: {
  flex: 1,
  marginLeft: 10,
  fontSize: 16,
  color: Colors.text,
  fontWeight: '600',
},
  headerCenter: {
    alignItems: 'center',
  },
  limitText: {
    fontSize: 12,
    color: Colors.white + '80',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  disabledButton: {
    opacity: 0.6,
  },
});