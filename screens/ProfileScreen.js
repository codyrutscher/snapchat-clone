import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FriendshipInsights } from '../components/AIAssistant';
import OpenAIService from '../services/OpenAIService';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function ProfileScreen({ navigation }) {
  const [activeStoriesCount, setActiveStoriesCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'snaps'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'story')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      let activeCount = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const expiresAt = new Date(data.expiresAt);
        if (expiresAt > now) {
          activeCount++;
        }
      });
      
      setActiveStoriesCount(activeCount);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    console.log('Logout button pressed');
    
    // For web, use window.confirm instead of Alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        performLogout();
      }
    } else {
      // For mobile, use React Native Alert
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  const fixUserData = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        friends: arrayUnion() // This creates an empty array if it doesn't exist
      });
      console.log('User data fixed');
      Alert.alert('Success', 'User data updated');
    } catch (error) {
      console.error('Error fixing user data:', error);
    }
  };

  const performLogout = async () => {
    console.log('Attempting to log out...');
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      console.log('Logout successful');
      // The auth state listener in App.js will handle navigation
    } catch (error) {
      console.error('Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert(`Failed to log out: ${error.message}`);
      } else {
        Alert.alert('Error', `Failed to log out: ${error.message}`);
      }
      setIsLoggingOut(false);
    }
  };

  const navigateToMyStories = () => {
    console.log('Navigating to My Stories');
    navigation.navigate('MyStories');
  };

  const user = auth.currentUser;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <Ionicons name="person-circle" size={100} color="#6B5CFF" />
        <Text style={styles.username}>{user?.displayName || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      <View style={styles.section}>
       
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('AddFriends')}
        >
          <Ionicons name="people-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Add Friends</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={navigateToMyStories}
        >
          <Ionicons name="images-outline" size={24} color="#333" />
          <Text style={styles.menuText}>My Stories</Text>
          {activeStoriesCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeStoriesCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
  style={styles.menuItem}
  onPress={() => setShowInsights(true)}
>
  <Ionicons name="analytics-outline" size={24} color="#333" />
  <Text style={styles.menuText}>Friendship Insights</Text>
  <Ionicons name="sparkles" size={16} color={Colors.primary} style={styles.aiIcon} />
</TouchableOpacity>

       
      </View>
       {/* Friendship Insights Modal */}
<Modal
  visible={showInsights}
  animationType="slide"
  transparent={true}
  onRequestClose={() => setShowInsights(false)}
>
  <View style={styles.insightsModal}>
    <View style={styles.insightsContent}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsTitle}>AI Friendship Insights</Text>
        <TouchableOpacity onPress={() => setShowInsights(false)}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      <FriendshipInsights />
    </View>
  </View>
</Modal>
<TouchableOpacity 
  style={styles.menuItem}
  onPress={() => navigation.navigate('Preferences')}
>
  <Ionicons name="settings-outline" size={24} color="#333" />
  <Text style={styles.menuText}>My Preferences</Text>
</TouchableOpacity>

      <TouchableOpacity 
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]} 
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        <Text style={styles.logoutText}>
          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
        </Text>
      </TouchableOpacity>

     
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  section: {
    marginTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  badge: {
    backgroundColor: '#6B5CFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    margin: 20,
    backgroundColor: '#FF6B5C',
    padding: 15,
    borderRadius: 25,
  },
  aiIcon: {
  position: 'absolute',
  right: 40,
},
insightsModal: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  padding: 20,
},
insightsContent: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  maxHeight: '80%',
  borderWidth: 1,  // Add this
  borderColor: 'red',  // Add this to see the container
},
insightsHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
},
insightsTitle: {
  fontSize: 20,
  fontWeight: 'bold',
},
  logoutButtonDisabled: {
    backgroundColor: '#ffb5ad',
  },
  logoutText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});