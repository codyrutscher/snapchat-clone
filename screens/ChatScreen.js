import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc, arrayUnion } from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Modal,
    ScrollView
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';
import ContentModerationService from '../services/ContentModerationService';

export default function ChatScreen({ route, navigation }) {
  const { chatId, chatName, chatType } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatInfo, setChatInfo] = useState(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: chatName || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => setShowOptionsModal(true)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, chatName]);

  useEffect(() => {
    if (!chatId) return;
    
    // Load chat info
    const loadChatInfo = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        setChatInfo(chatDoc.data());
      }
    };
    
    loadChatInfo();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messageList);
    });

    return unsubscribe;
  }, [chatId]);

  const sendMessage = async () => {
    if (inputText.trim() && chatId && auth.currentUser) {
      try {
        // Check content moderation
        const moderationResult = await ContentModerationService.moderateText(inputText);
        
        if (moderationResult.flagged) {
          Alert.alert(
            'Message Blocked',
            `Your message was blocked: ${moderationResult.reason}`,
            [{ text: 'OK' }]
          );
          return;
        }

        const messageData = {
          text: inputText.trim(),
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Anonymous',
          timestamp: new Date().toISOString(),
        };

        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: inputText.trim(),
          lastMessageTime: new Date().toISOString(),
        });

        setInputText('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const blockUser = async (userId, username) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${username}? They won't be able to send you messages or find your profile.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              // Add to blocked users
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                blockedUsers: arrayUnion(userId)
              });
              
              Alert.alert('User Blocked', `${username} has been blocked`);
              navigation.goBack();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const reportUser = async (userId, username) => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    try {
      // Create report document
      await addDoc(collection(db, 'reports'), {
        reportedUserId: userId,
        reportedUsername: username,
        reportedBy: auth.currentUser.uid,
        reporterUsername: auth.currentUser.displayName,
        reason: reportReason,
        chatId: chatId,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review this report.',
        [{ text: 'OK', onPress: () => setShowReportModal(false) }]
      );
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  const getOtherUserId = () => {
    if (chatType === 'group' || !chatInfo) return null;
    return chatInfo.participants.find(id => id !== auth.currentUser.uid);
  };

  const getOtherUsername = () => {
    if (chatType === 'group' || !chatInfo) return chatName;
    const otherId = getOtherUserId();
    return chatInfo.participantNames?.[otherId] || 'User';
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === auth.currentUser?.uid;
    const isSystemMessage = item.senderId === 'system';
    
    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        {chatType === 'group' && !isMyMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
          {item.text}
        </Text>
        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  const reportReasons = [
    'Spam or fake account',
    'Inappropriate content',
    'Harassment or bullying',
    'Hate speech',
    'Violence or threats',
    'Other'
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messagesList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons 
            name="send" 
            size={24} 
            color={inputText.trim() ? 'white' : '#ccc'} 
          />
        </TouchableOpacity>
      </View>

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsContainer}>
            {chatType !== 'group' && (
              <>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setShowOptionsModal(false);
                    const otherId = getOtherUserId();
                    const otherName = getOtherUsername();
                    if (otherId) {
                      blockUser(otherId, otherName);
                    }
                  }}
                >
                  <Ionicons name="ban" size={24} color={Colors.danger} />
                  <Text style={[styles.optionText, { color: Colors.danger }]}>
                    Block {getOtherUsername()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setShowOptionsModal(false);
                    setShowReportModal(true);
                  }}
                >
                  <Ionicons name="flag" size={24} color={Colors.warning} />
                  <Text style={[styles.optionText, { color: Colors.warning }]}>
                    Report {getOtherUsername()}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity 
              style={styles.optionItem}
              onPress={() => {
                setShowOptionsModal(false);
                Alert.alert(
                  'Chat Info',
                  chatType === 'group' 
                    ? `Group: ${chatName}\nMembers: ${chatInfo?.participants?.length || 0}`
                    : `Chat with ${getOtherUsername()}`
                );
              }}
            >
              <Ionicons name="information-circle" size={24} color={Colors.primary} />
              <Text style={styles.optionText}>Chat Info</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionItem, styles.cancelOption]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportContainer}>
            <Text style={styles.reportTitle}>Report {getOtherUsername()}</Text>
            <Text style={styles.reportSubtitle}>Why are you reporting this user?</Text>
            
            <ScrollView style={styles.reasonsList}>
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonItem,
                    reportReason === reason && styles.selectedReason
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={styles.reasonText}>{reason}</Text>
                  {reportReason === reason && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.reportActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.reportButton, !reportReason && styles.reportButtonDisabled]}
                onPress={() => {
                  const otherId = getOtherUserId();
                  const otherName = getOtherUsername();
                  if (otherId && reportReason) {
                    reportUser(otherId, otherName);
                  }
                }}
                disabled={!reportReason}
              >
                <Text style={styles.reportButtonText}>Submit Report</Text>
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
    backgroundColor: 'white',
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    padding: 12,
    marginVertical: 5,
    marginHorizontal: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  myMessageContainer: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  myMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  senderName: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 16,
    marginLeft: 15,
    color: Colors.black,
  },
  cancelOption: {
    justifyContent: 'center',
    borderBottomWidth: 0,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.gray,
    textAlign: 'center',
  },
  reportContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  reportSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  reasonsList: {
    paddingHorizontal: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedReason: {
    backgroundColor: Colors.primary + '10',
  },
  reasonText: {
    fontSize: 16,
  },
  reportActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.gray,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.gray,
    fontWeight: 'bold',
  },
  reportButton: {
    flex: 1,
    padding: 15,
    borderRadius: 25,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  reportButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  reportButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});