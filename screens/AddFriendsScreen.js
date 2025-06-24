import { Ionicons } from '@expo/vector-icons';
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function AddFriendsScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

  useEffect(() => {
    const unsubscribe = loadUserData();
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const loadUserData = () => {
    try {
      // Get current user's data with real-time updates
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      
      // Set up real-time listener for user document
      const userUnsubscribe = onSnapshot(userDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          console.log('User data updated:', userData);
          
          if (!userData.friends) {
            console.log('Friends array missing, creating...');
            await updateDoc(userDocRef, {
              friends: []
            });
            setFriends([]);
          } else {
            setFriends(userData.friends);
          }
          
          setCurrentUsername(userData.username || userData.displayName || auth.currentUser.email.split('@')[0]);
        } else {
          console.error('User document does not exist!');
          // Create user document if it doesn't exist
          await setDoc(userDocRef, {
            username: auth.currentUser.email.split('@')[0],
            email: auth.currentUser.email,
            friends: [],
            createdAt: new Date().toISOString(),
            userId: auth.currentUser.uid
          });
        }
      }, (error) => {
        console.error('Error listening to user document:', error);
      });

      // Listen to received friend requests in real-time
      const requestsQuery = query(
        collection(db, 'friendRequests'),
        where('to', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );

      const requestsUnsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() });
        });
        setFriendRequests(requests);
        console.log('Friend requests updated:', requests.length);
      }, (error) => {
        console.error('Error listening to friend requests:', error);
      });

      // Listen to sent friend requests in real-time
      const sentRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );

      const sentRequestsUnsubscribe = onSnapshot(sentRequestsQuery, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() });
        });
        setSentRequests(requests);
        console.log('Sent friend requests updated:', requests.length);
      }, (error) => {
        console.error('Error listening to sent requests:', error);
      });

      // Return cleanup function
      return () => {
        userUnsubscribe();
        requestsUnsubscribe();
        sentRequestsUnsubscribe();
      };
    } catch (error) {
      console.error('Error setting up listeners:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const searchUsers = async () => {
    if (!searchText.trim()) {
      Alert.alert('Error', 'Please enter a username to search');
      return;
    }

    setLoading(true);
    console.log('Searching for:', searchText);

    try {
      const searchTerm = searchText.trim().toLowerCase();
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const results = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        console.log('Checking user:', userData.username, 'against:', searchTerm);
        
        // Skip current user
        if (doc.id === auth.currentUser.uid) return;
        
        // Check if username contains search term
        if (userData.username && userData.username.toLowerCase().includes(searchTerm)) {
          results.push({ 
            id: doc.id, 
            ...userData,
            displayUsername: userData.displayName || userData.username 
          });
        }
      });
      
      console.log('Search results:', results);
      setSearchResults(results);
      
      if (results.length === 0) {
        Alert.alert('No Results', 'No users found with that username');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (toUser) => {
    setSendingRequest(true);
    try {
      console.log('=== STARTING FRIEND REQUEST PROCESS ===');
      console.log('1. Sending to user:', toUser);
      console.log('2. Current user ID:', auth.currentUser?.uid);
      console.log('3. Current username:', currentUsername);
      console.log('4. Current friends array:', friends);

      // Validate current user
      if (!auth.currentUser) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      // Check if already friends
      if (friends && friends.includes(toUser.id)) {
        Alert.alert('Info', 'You are already friends with this user');
        return;
      }

      // Check for existing requests
      console.log('5. Checking for existing friend requests...');
      const requestsRef = collection(db, 'friendRequests');
      
      // Check requests FROM current user TO target user
      const sentRequestQuery = query(
        requestsRef,
        where('from', '==', auth.currentUser.uid),
        where('to', '==', toUser.id),
        where('status', '==', 'pending')
      );
      
      const sentRequests = await getDocs(sentRequestQuery);
      
      if (!sentRequests.empty) {
        Alert.alert('Request Already Sent', `You already sent a friend request to ${toUser.displayUsername}.`);
        return;
      }

      // Check requests FROM target user TO current user
      const receivedRequestQuery = query(
        requestsRef,
        where('from', '==', toUser.id),
        where('to', '==', auth.currentUser.uid),
        where('status', '==', 'pending')
      );
      
      const receivedRequests = await getDocs(receivedRequestQuery);
      
      if (!receivedRequests.empty) {
        Alert.alert(
          'Friend Request Already Received!', 
          `${toUser.displayUsername} already sent you a friend request! Check your friend requests above to accept it.`
        );
        return;
      }

      // Create friend request data
      const requestData = {
        from: auth.currentUser.uid,
        fromUsername: currentUsername || auth.currentUser.email?.split('@')[0] || 'User',
        to: toUser.id,
        toUsername: toUser.displayUsername || toUser.username,
        status: 'pending',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      console.log('8. Friend request data prepared:', JSON.stringify(requestData, null, 2));

      // Create the friend request
      const docRef = await addDoc(collection(db, 'friendRequests'), requestData);
      
      console.log('10. SUCCESS! Friend request created with ID:', docRef.id);

      // Show success message
      Alert.alert('Success', `Friend request sent to ${toUser.displayUsername || toUser.username}!`);

      // Clear search
      setSearchResults([]);
      setSearchText('');

    } catch (error) {
      console.error('=== FRIEND REQUEST ERROR ===');
      console.error('Error:', error);
      
      let errorMessage = 'Failed to send friend request';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check Firebase rules.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  const acceptFriendRequest = async (request) => {
    try {
      console.log('Accepting friend request:', request);

      // Update both users' friends lists
      const batch = [];
      
      // Update current user
      batch.push(
        updateDoc(doc(db, 'users', auth.currentUser.uid), {
          friends: arrayUnion(request.from)
        })
      );

      // Update friend user
      batch.push(
        updateDoc(doc(db, 'users', request.from), {
          friends: arrayUnion(auth.currentUser.uid)
        })
      );

      // Execute updates
      await Promise.all(batch);

      // Update request status
      await updateDoc(doc(db, 'friendRequests', request.id), {
        status: 'accepted',
        acceptedAt: new Date().toISOString()
      });

      // Create a chat between the two users
      const chatData = {
        participants: [auth.currentUser.uid, request.from],
        participantNames: {
          [auth.currentUser.uid]: currentUsername,
          [request.from]: request.fromUsername
        },
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        type: 'direct'
      };

      console.log('Creating chat:', chatData);
      await addDoc(collection(db, 'chats'), chatData);

      Alert.alert('Success', `You are now friends with ${request.fromUsername}!`);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const cancelSentRequest = async (request) => {
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Friend request cancelled');
    } catch (error) {
      console.error('Error cancelling request:', error);
      Alert.alert('Error', 'Failed to cancel request');
    }
  };

  const renderSearchResult = ({ item }) => {
    const isFriend = friends.includes(item.id);
    const hasPendingRequest = sentRequests.some(req => req.to === item.id);
    
    return (
      <View style={styles.userItem}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={40} color={Colors.primary} />
          <View style={styles.userText}>
            <Text style={styles.username}>{item.displayUsername || item.username}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
        </View>
        {isFriend ? (
          <View style={styles.friendBadge}>
            <Text style={styles.friendBadgeText}>Friends</Text>
          </View>
        ) : hasPendingRequest ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        ) : sendingRequest ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => sendFriendRequest(item)}
            disabled={sendingRequest}
          >
            <Ionicons name="person-add" size={20} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.userInfo}>
        <Ionicons name="person-circle" size={40} color={Colors.primary} />
        <View style={styles.userText}>
          <Text style={styles.username}>{item.fromUsername}</Text>
          <Text style={styles.requestText}>sent you a friend request</Text>
        </View>
      </View>
      <View style={styles.requestButtons}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptFriendRequest(item)}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequest = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.userInfo}>
        <Ionicons name="person-circle" size={40} color={Colors.gray} />
        <View style={styles.userText}>
          <Text style={styles.username}>{item.toUsername}</Text>
          <Text style={styles.requestText}>Request sent {new Date(item.timestamp).toLocaleDateString()}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => cancelSentRequest(item)}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={searchUsers}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={Colors.gray}
          />
        </View>
        <TouchableOpacity 
          style={[styles.searchButton, loading && styles.searchButtonDisabled]} 
          onPress={searchUsers}
          disabled={loading}
        >
          <Text style={styles.searchButtonText}>
            {loading ? '...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>

      {friendRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</Text>
          <FlatList
            data={friendRequests}
            renderItem={renderFriendRequest}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {sentRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sent Requests ({sentRequests.length})</Text>
          <FlatList
            data={sentRequests}
            renderItem={renderSentRequest}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {searchResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Results ({searchResults.length})</Text>
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {!loading && searchResults.length === 0 && friendRequests.length === 0 && sentRequests.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={60} color={Colors.gray} />
          <Text style={styles.emptyText}>Search for friends by username</Text>
          <Text style={styles.debugText}>Current User: {currentUsername}</Text>
          <Text style={styles.debugText}>Friends: {friends.length}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 25,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.black,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    minWidth: 70,
  },
  searchButtonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  searchButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 15,
    marginBottom: 10,
    color: Colors.primary,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.primaryLight + '20',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userText: {
    marginLeft: 10,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
  },
  email: {
    fontSize: 14,
    color: Colors.gray,
  },
  requestText: {
    fontSize: 14,
    color: Colors.gray,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: Colors.success,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  acceptText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: Colors.danger,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  cancelText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  friendBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  friendBadgeText: {
    color: Colors.success,
    fontWeight: 'bold',
  },
  pendingBadge: {
    backgroundColor: Colors.gray + '20',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gray,
  },
  pendingText: {
    color: Colors.gray,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray,
    marginTop: 10,
  },
  debugText: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 5,
  },
});