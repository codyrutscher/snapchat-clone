import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
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
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function ChatScreen({ route, navigation }) {
  const { chatId, chatName, chatType } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatInfo, setChatInfo] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: chatName || 'Chat',
      headerRight: () => (
        chatType === 'group' && (
          <TouchableOpacity
            style={{ marginRight: 15 }}
            onPress={() => {
              Alert.alert(
                'Group Info',
                `${chatInfo?.participants?.length || 0} members`,
                [{ text: 'OK' }]
              );
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color={Colors.white} />
          </TouchableOpacity>
        )
      ),
    });
  }, [navigation, chatName, chatType, chatInfo]);

  useEffect(() => {
    if (!chatId) return;
    
    // Load chat info for group features
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
});