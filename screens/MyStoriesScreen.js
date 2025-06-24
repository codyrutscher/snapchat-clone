import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SnapRenderer from '../components/SnapRenderer';
import { auth, db, storage } from '../firebase';

const { width } = Dimensions.get('window');
const imageSize = (width - 30) / 2;

export default function MyStoriesScreen() {
  const [myStories, setMyStories] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Get only current user's stories
    const q = query(
      collection(db, 'snaps'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'story')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = [];
      const now = new Date();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const expiresAt = new Date(data.expiresAt);
        
        // Include both active and expired stories for management
        storyList.push({ 
          id: doc.id, 
          ...data,
          expired: expiresAt <= now 
        });
      });
      
      // Sort by timestamp
      storyList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setMyStories(storyList);
    });

    return unsubscribe;
  }, []);

  const deleteStory = async (story) => {
    console.log('Starting delete process for story:', story.id);
    
    // Use Platform.OS to handle different alert implementations
    const confirmDelete = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const result = window.confirm('Are you sure you want to delete this story?');
          resolve(result);
        } else {
          Alert.alert(
            'Delete Story',
            'Are you sure you want to delete this story?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true }
          );
        }
      });
    };

    const shouldDelete = await confirmDelete();
    
    if (shouldDelete) {
      try {
        console.log('Deleting story from Firestore...');
        // Delete from Firestore
        await deleteDoc(doc(db, 'snaps', story.id));
        console.log('Story deleted from Firestore');
        
        // Delete image from Storage
        if (story.imageUrl) {
          try {
            // Extract the file path from the URL
            const urlParts = story.imageUrl.split('/o/');
            if (urlParts.length > 1) {
              const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
              const imageRef = ref(storage, filePath);
              await deleteObject(imageRef);
              console.log('Image deleted from Storage');
            }
          } catch (storageError) {
            console.log('Storage deletion error:', storageError);
            // Continue even if storage deletion fails
          }
        }
        
        // Show success message
        if (Platform.OS === 'web') {
          window.alert('Story deleted successfully');
        } else {
          Alert.alert('Success', 'Story deleted successfully');
        }
      } catch (error) {
        console.error('Delete error:', error);
        if (Platform.OS === 'web') {
          window.alert('Failed to delete story: ' + error.message);
        } else {
          Alert.alert('Error', 'Failed to delete story: ' + error.message);
        }
      }
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const storyTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - storyTime.getTime()) / 60000);
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderStory = ({ item }) => (
    <View style={styles.storyContainer}>
      <View style={styles.storyItem}>
        <View style={[styles.storyImageWrapper, item.expired && styles.expiredWrapper]}>
          <SnapRenderer
            imageUrl={item.imageUrl}
            metadata={item.metadata}
            containerStyle={styles.storyThumbnailContainer}
            imageStyle={styles.storyThumbnail}
          />
        </View>
        {item.expired && (
          <View style={styles.expiredOverlay}>
            <Text style={styles.expiredText}>Expired</Text>
          </View>
        )}
        <View style={styles.storyOverlay}>
          <Text style={styles.storyTime}>{getTimeAgo(item.timestamp)}</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => {
          console.log('Delete button pressed for story:', item.id);
          deleteStory(item);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Stories</Text>
      
      {myStories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>No stories yet</Text>
          <Text style={styles.emptySubtext}>Share a story from the camera!</Text>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {myStories.filter(s => !s.expired).length} active, {myStories.filter(s => s.expired).length} expired
          </Text>
          <FlatList
            data={myStories}
            renderItem={renderStory}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  listContainer: {
    padding: 10,
  },
  storyContainer: {
    width: imageSize,
    margin: 5,
  },
  storyItem: {
    width: '100%',
    height: imageSize * 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  storyImageWrapper: {
    width: '100%',
    height: '100%',
  },
  expiredWrapper: {
    opacity: 0.5,
  },
  storyThumbnailContainer: {
    width: '100%',
    height: '100%',
  },
  storyThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  expiredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiredText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  storyTime: {
    color: 'white',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#FF6B5C',
    borderRadius: 20,
    padding: 10,
    marginTop: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});