import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    Platform,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function CreateGroupScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        
        if (friendIds.length > 0) {
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
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      }
      return [...prev, friendId];
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedFriends.length < 2) {
      Alert.alert('Error', 'Please select at least 2 friends for a group chat');
      return;
    }

    setCreating(true);
    try {
      // Create participants array including current user
      const participants = [auth.currentUser.uid, ...selectedFriends];
      
      // Get current user's name
      const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const currentUserData = currentUserDoc.data();
      
      // Create participant names object
      const participantNames = {
        [auth.currentUser.uid]: currentUserData.username || currentUserData.displayName || 'User'
      };
      
      // Add friend names
      for (const friend of friends) {
        if (selectedFriends.includes(friend.id)) {
          participantNames[friend.id] = friend.username || friend.displayName || 'Friend';
        }
      }

      // Create the group chat
      const chatData = {
        name: groupName,
        participants: participants,
        participantNames: participantNames,
        createdBy: auth.currentUser.uid,
        lastMessage: 'Group created',
        lastMessageTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        type: 'group',
        groupIcon: null, // Can add group icon functionality later
        admins: [auth.currentUser.uid] // Creator is admin
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      
      // Add initial system message
      await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
        text: `${currentUserData.username || 'Someone'} created the group "${groupName}"`,
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date().toISOString(),
        type: 'system'
      });

      Alert.alert('Success', 'Group created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const renderFriend = ({ item }) => {
    const isSelected = selectedFriends.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item.id)}
      >
        <Ionicons name="person-circle" size={40} color={Colors.primary} />
        <Text style={styles.friendName}>{item.username || item.displayName}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Group</Text>
        <TouchableOpacity 
          onPress={createGroup}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.createButton}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Group name..."
          value={groupName}
          onChangeText={setGroupName}
          maxLength={30}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Add Friends ({selectedFriends.length} selected)
        </Text>
        {friends.length === 0 ? (
          <Text style={styles.noFriendsText}>
            No friends to add. Add friends first!
          </Text>
        ) : (
          <FlatList
            data={friends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
          />
        )}
      </View>

      {selectedFriends.length > 0 && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''} selected
          </Text>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    padding: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.black,
  },
  createButton: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    backgroundColor: Colors.white,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  input: {
    fontSize: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
  },
  section: {
    flex: 1,
    backgroundColor: Colors.white,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: Colors.background,
    color: Colors.gray,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  friendItemSelected: {
    backgroundColor: Colors.primary + '10',
  },
  friendName: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  noFriendsText: {
    textAlign: 'center',
    padding: 50,
    color: Colors.gray,
    fontSize: 16,
  },
  selectedInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 15,
  },
  selectedText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});