import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function ChatListScreen({ navigation, route }) {
  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const sharedSnippet = route?.params?.sharedSnippet;

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load user data including blocked users
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        const blocked = userData.blockedUsers || [];
        
        setFriends(friendIds);
        setBlockedUsers(blocked);
        
        // Load chats after we have blocked users list
        loadChats(blocked);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const loadChats = (blockedUsersList) => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = [];
      snapshot.forEach((doc) => {
        const chatData = { id: doc.id, ...doc.data() };
        
        // Filter out chats with blocked users
        if (chatData.type === 'group') {
          // For group chats, check if any participant is blocked
          const hasBlockedUser = chatData.participants.some(participantId => 
            blockedUsersList.includes(participantId) && participantId !== auth.currentUser.uid
          );
          if (!hasBlockedUser) {
            chatList.push(chatData);
          }
        } else {
          // For direct chats, check if the other user is blocked
          const otherUserId = chatData.participants.find(id => id !== auth.currentUser.uid);
          if (!blockedUsersList.includes(otherUserId)) {
            chatList.push(chatData);
          }
        }
      });
      
      // Sort by last message time
      chatList.sort((a, b) => {
        const timeA = new Date(a.lastMessageTime || 0);
        const timeB = new Date(b.lastMessageTime || 0);
        return timeB - timeA;
      });
      
      setChats(chatList);
      setLoading(false);
    });

    return unsubscribe;
  };

  const getChatName = (chat) => {
    // For group chats, return the group name
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    }
    
    // For friend chats, show the friend's name
    if (chat.participantNames && chat.participants.length === 2) {
      const friendId = chat.participants.find(id => id !== auth.currentUser.uid);
      return chat.participantNames[friendId] || 'Chat';
    }
    return chat.name || 'Chat';
  };

  const renderChat = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('ChatDetail', { 
        chatId: item.id, 
        chatName: getChatName(item),
        chatType: item.type || 'direct',
        sharedSnippet: sharedSnippet
      })}
    >
      <View style={styles.avatarContainer}>
        <Ionicons 
          name={item.type === 'group' ? 'people-circle' : 'person-circle'} 
          size={50} 
          color={Colors.primary} 
        />
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{getChatName(item)}</Text>
          {item.type === 'group' && (
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>GROUP</Text>
            </View>
          )}
        </View>
        <Text style={styles.lastMessage}>
          {item.lastMessage || 'Start a conversation'}
        </Text>
        {item.lastMessageTime && (
          <Text style={styles.messageTime}>
            {formatMessageTime(item.lastMessageTime)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
    </TouchableOpacity>
  );

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const navigateToAddFriends = () => {
    navigation.navigate('AddFriends');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sharedSnippet && (
        <View style={styles.shareHeader}>
          <Ionicons name="code-slash" size={20} color={Colors.primary} />
          <Text style={styles.shareHeaderText}>
            Select a chat to share "{sharedSnippet.title}"
          </Text>
        </View>
      )}
      {friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={80} color={Colors.primary} />
          <Text style={styles.emptyText}>No friends yet</Text>
          <Text style={styles.emptySubtext}>Add friends to start chatting!</Text>
          <TouchableOpacity style={styles.addFriendsButton} onPress={navigateToAddFriends}>
            <Text style={styles.addFriendsButtonText}>Add Friends</Text>
          </TouchableOpacity>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color={Colors.primary} />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Send a message to your friends!</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {friends.length > 0 && (
        <>
          <TouchableOpacity 
            style={[styles.floatingButton, styles.createGroupButton]} 
            onPress={() => navigation.navigate('CreateGroup')}
          >
            <Ionicons name="people" size={24} color={Colors.white} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.floatingButton} 
            onPress={navigateToAddFriends}
          >
            <Ionicons name="person-add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingVertical: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.white,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
  },
  groupBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 5,
  },
  messageTime: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 10,
    textAlign: 'center',
  },
  addFriendsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  addFriendsButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  createGroupButton: {
    bottom: 90,
    backgroundColor: Colors.success,
  },
  shareHeader: {
    backgroundColor: Colors.primary + '10',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  shareHeaderText: {
    flex: 1,
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
});