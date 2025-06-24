import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [showingLocation, setShowingLocation] = useState(false);

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for Snap Map');
        setLoading(false);
        return;
      }

      // Get current location
      try {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation.coords);
      } catch (error) {
        console.log('Error getting location:', error);
        // Fallback for web
        if (Platform.OS === 'web') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              console.error('Geolocation error:', error);
            }
          );
        }
      }
      setLoading(false);

      // Check if user is already sharing location
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().sharingLocation) {
        setShowingLocation(true);
      }

      // Load friends with location sharing enabled
      loadFriendsLocations();
    })();
  }, []);

  const loadFriendsLocations = () => {
    if (!auth.currentUser) return;

    // Get user's friends first
    const loadFriendsWithLocation = async () => {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) return;
      
      const friendIds = userDoc.data().friends || [];
      if (friendIds.length === 0) return;

      // Listen to friends who are sharing their location
      const q = query(
        collection(db, 'users'),
        where('sharingLocation', '==', true)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const friendsWithLocation = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Only show friends who are sharing location
          if (friendIds.includes(doc.id) && data.location) {
            friendsWithLocation.push({
              id: doc.id,
              ...data,
              lastSeen: data.location.timestamp ? new Date(data.location.timestamp) : new Date()
            });
          }
        });
        setFriends(friendsWithLocation);
      });

      return unsubscribe;
    };

    loadFriendsWithLocation();
  };

  const toggleLocationSharing = async () => {
    if (!location) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      return;
    }

    try {
      const newStatus = !showingLocation;
      setShowingLocation(newStatus);

      if (newStatus) {
        // Update user's location in Firestore
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          sharingLocation: true,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: new Date().toISOString()
          }
        });
        Alert.alert('Location Sharing', 'Your location is now visible to friends');
      } else {
        // Stop sharing location
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          sharingLocation: false,
          location: null
        });
        Alert.alert('Location Sharing', 'Your location is now hidden');
      }
    } catch (error) {
      console.error('Error toggling location:', error);
      Alert.alert('Error', 'Failed to update location sharing');
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Snap Map</Text>
        <TouchableOpacity
          style={[styles.shareButton, showingLocation && styles.activeButton]}
          onPress={toggleLocationSharing}
        >
          <Ionicons 
            name={showingLocation ? "location" : "location-outline"} 
            size={20} 
            color="white" 
          />
          <Text style={styles.shareButtonText}>
            {showingLocation ? 'Sharing' : 'Share Location'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Location Info */}
      {location && (
        <View style={styles.locationInfo}>
          <Ionicons name="navigate-circle" size={40} color={Colors.primary} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationTitle}>Your Location</Text>
            <Text style={styles.locationCoords}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
            {showingLocation && (
              <Text style={styles.sharingStatus}>Visible to friends</Text>
            )}
          </View>
        </View>
      )}

      {/* Friends List */}
      <Text style={styles.sectionTitle}>Friends on Map ({friends.length})</Text>
      
      <ScrollView style={styles.friendsList}>
        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={Colors.gray} />
            <Text style={styles.emptyText}>No friends sharing location</Text>
            <Text style={styles.emptySubtext}>
              When your friends share their location, they'll appear here
            </Text>
          </View>
        ) : (
          friends.map((friend) => (
            <View key={friend.id} style={styles.friendItem}>
              <Ionicons name="person-circle" size={50} color={Colors.primary} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>
                  {friend.username || friend.displayName}
                </Text>
                <Text style={styles.friendLocation}>
                  {friend.location.latitude.toFixed(4)}, {friend.location.longitude.toFixed(4)}
                </Text>
                <Text style={styles.friendTime}>
                  {getTimeAgo(friend.lastSeen)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Note for web users */}
      {Platform.OS === 'web' && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            Map view is simplified on web. Use the mobile app for full map experience.
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
  loadingText: {
    marginTop: 10,
    color: Colors.gray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.black,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  activeButton: {
    backgroundColor: Colors.primary,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.white,
    marginBottom: 10,
  },
  locationTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
  },
  locationCoords: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  sharingStatus: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: Colors.black,
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
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
  friendInfo: {
    marginLeft: 15,
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
  },
  friendLocation: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  friendTime: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 10,
    textAlign: 'center',
  },
  webNote: {
    backgroundColor: Colors.primary + '10',
    padding: 15,
    margin: 20,
    borderRadius: 10,
  },
  webNoteText: {
    color: Colors.primary,
    textAlign: 'center',
    fontSize: 14,
  },
});