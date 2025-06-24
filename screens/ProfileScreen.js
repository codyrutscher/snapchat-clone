import { Ionicons } from '@expo/vector-icons';
import { signOut, updateProfile } from 'firebase/auth';
import { collection, doc, updateDoc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { 
  Alert, 
  Modal, 
  Platform, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Image,
  ActivityIndicator,
  Switch,
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FriendshipInsights } from '../components/AIAssistant';
import OpenAIService from '../services/OpenAIService';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';
import { uploadToCloudinary } from '../services/cloudinaryConfig';

export default function ProfileScreen({ navigation }) {
  const [activeStoriesCount, setActiveStoriesCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'everyone', // everyone, friends, nobody
    allowFriendRequests: true,
    showLocation: false,
    showActiveStatus: true,
    allowSearchByUsername: true,
    allowSearchByPhone: false,
  });
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load user data including profile picture and privacy settings
    loadUserData();

    // Load active stories count
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

  const loadUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.profilePicture) {
          setProfilePicture(data.profilePicture);
        }
        if (data.privacySettings) {
          setPrivacySettings(data.privacySettings);
        }
        if (data.blockedUsers) {
          setBlockedUsers(data.blockedUsers);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const pickProfilePicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadProfilePicture(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (uri) => {
    setUploadingPhoto(true);
    try {
      // Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(uri, 'image');
      
      // Update user profile in Firebase Auth
      await updateProfile(auth.currentUser, {
        photoURL: cloudinaryUrl
      });

      // Update user document in Firestore
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        profilePicture: cloudinaryUrl
      });

      setProfilePicture(cloudinaryUrl);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updatePrivacySettings = async (newSettings) => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        privacySettings: newSettings
      });
      setPrivacySettings(newSettings);
      Alert.alert('Success', 'Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      Alert.alert('Error', 'Failed to update privacy settings');
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        performLogout();
      }
    } else {
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

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
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

  const user = auth.currentUser;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={pickProfilePicture} style={styles.profilePictureContainer}>
          {uploadingPhoto ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
          ) : (
            <Ionicons name="person-circle" size={100} color={Colors.primary} />
          )}
          <View style={styles.editIconContainer}>
            <Ionicons name="camera" size={20} color="white" />
          </View>
        </TouchableOpacity>
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
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <Ionicons name="ban-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Blocked Users</Text>
          {blockedUsers.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{blockedUsers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('MyStories')}
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

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => setShowPrivacySettings(true)}
        >
          <Ionicons name="lock-closed-outline" size={24} color="#333" />
          <Text style={styles.menuText}>Privacy Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('Preferences')}
        >
          <Ionicons name="settings-outline" size={24} color="#333" />
          <Text style={styles.menuText}>My Preferences</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Settings Modal */}
      <Modal
        visible={showPrivacySettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacySettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Settings</Text>
              <TouchableOpacity onPress={() => setShowPrivacySettings(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.privacyOptions}>
              <Text style={styles.privacySection}>Profile Visibility</Text>
              {['everyone', 'friends', 'nobody'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.privacyOption,
                    privacySettings.profileVisibility === option && styles.selectedOption
                  ]}
                  onPress={() => updatePrivacySettings({
                    ...privacySettings,
                    profileVisibility: option
                  })}
                >
                  <Text style={styles.optionText}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                  {privacySettings.profileVisibility === option && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={styles.privacySection}>Discoverability</Text>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Allow Friend Requests</Text>
                <Switch
                  value={privacySettings.allowFriendRequests}
                  onValueChange={(value) => updatePrivacySettings({
                    ...privacySettings,
                    allowFriendRequests: value
                  })}
                  trackColor={{ false: Colors.gray, true: Colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show Location on Map</Text>
                <Switch
                  value={privacySettings.showLocation}
                  onValueChange={(value) => updatePrivacySettings({
                    ...privacySettings,
                    showLocation: value
                  })}
                  trackColor={{ false: Colors.gray, true: Colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show Active Status</Text>
                <Switch
                  value={privacySettings.showActiveStatus}
                  onValueChange={(value) => updatePrivacySettings({
                    ...privacySettings,
                    showActiveStatus: value
                  })}
                  trackColor={{ false: Colors.gray, true: Colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Allow Search by Username</Text>
                <Switch
                  value={privacySettings.allowSearchByUsername}
                  onValueChange={(value) => updatePrivacySettings({
                    ...privacySettings,
                    allowSearchByUsername: value
                  })}
                  trackColor={{ false: Colors.gray, true: Colors.primary }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]} 
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        <Text style={styles.logoutText}>
          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
  aiIcon: {
    position: 'absolute',
    right: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  privacyOptions: {
    maxHeight: 400,
  },
  privacySection: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: Colors.primary,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: Colors.primary + '10',
  },
  optionText: {
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
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
  logoutButton: {
    margin: 20,
    backgroundColor: '#FF6B5C',
    padding: 15,
    borderRadius: 25,
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