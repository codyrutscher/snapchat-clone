import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import SnapRenderer from '../components/SnapRenderer';
import { StoryIdeasWidget } from '../components/AIAssistant';
import { Video } from 'expo-av';
import { db } from '../firebase';

const { width } = Dimensions.get('window');
const imageSize = (width - 30) / 2;

export default function StoriesScreen() {
  const [stories, setStories] = useState([]);
  const [viewingStory, setViewingStory] = useState(null);
  const [viewTimer, setViewTimer] = useState(null);
  const [page, setPage] = useState(0);
  const STORIES_PER_PAGE = 20;

  useEffect(() => {
    // Simpler query - just get story type
    const q = query(
      collection(db, 'snaps'),
      where('type', '==', 'story')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyList = [];
      const now = new Date();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const expiresAt = new Date(data.expiresAt);
        
        // Filter expired stories client-side
        if (expiresAt > now) {
          storyList.push({ id: doc.id, ...data });
        }
      });
      
      // Sort by timestamp client-side
      storyList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      console.log('Stories found:', storyList.length);
      setStories(storyList);
    });

    return () => {
      unsubscribe();
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, []);

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const storyTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - storyTime.getTime()) / 60000);
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const viewStory = (story) => {
    // Clear any existing timer first
    if (viewTimer) {
      clearTimeout(viewTimer);
    }
    
    setViewingStory(story);
    
    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      setViewingStory(null);
      setViewTimer(null); // Clear timer reference
    }, 10000);
    
    setViewTimer(timer);
  };

  const closeStory = () => {
    if (viewTimer) {
      clearTimeout(viewTimer);
      setViewTimer(null); // Clear timer reference
    }
    setViewingStory(null);
  };

const renderStory = ({ item }) => (
  <TouchableOpacity style={styles.storyItem} onPress={() => viewStory(item)}>
    <View style={styles.storyImageContainer}>
      {item.mediaType === 'video' ? (
        // Show a thumbnail or placeholder for videos instead of playing them
        <View style={styles.videoThumbnail}>
          <Ionicons name="play-circle" size={40} color="white" />
          {item.imageUrl && (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.storyThumbnail}
            />
          )}
        </View>
      ) : (
        <SnapRenderer
          imageUrl={item.imageUrl}
          imageData={item.imageData}
          metadata={item.metadata}
          containerStyle={styles.storyThumbnailContainer}
          imageStyle={styles.storyThumbnail}
        />
      )}
    </View>
    <View style={styles.storyOverlay}>
      <Text style={styles.username}>{item.username}</Text>
      <Text style={styles.storyTime}>{getTimeAgo(item.timestamp)}</Text>
    </View>
  </TouchableOpacity>
);

  return (
    <View style={styles.container}>
      {stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stories yet</Text>
          <Text style={styles.emptySubtext}>Be the first to share!</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Stories</Text>
            <StoryIdeasWidget 
  onSelectIdea={(idea) => {
    Alert.alert(
      'Story Idea Selected',
      `"${idea}"\n\nGo to the camera when you're ready to create this story!`,
      [
        { text: 'Got it!', style: 'default' }
      ]
    );
  }}
/>
          </View>
          <FlatList
            data={stories.slice(0, (page + 1) * STORIES_PER_PAGE)}
            renderItem={renderStory}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            onEndReached={() => {
              if ((page + 1) * STORIES_PER_PAGE < stories.length) {
                setPage(page + 1);
              }
            }}
            onEndReachedThreshold={0.5}
          />
        </>
      )}

     <Modal
  visible={viewingStory !== null}
  animationType="fade"
  onRequestClose={closeStory}
>
  {viewingStory && (
    <TouchableOpacity 
      style={styles.storyModal} 
      activeOpacity={1}
      onPress={closeStory}
    >
      <View style={styles.storyHeader}>
        <View style={styles.storyHeaderInfo}>
          <Ionicons name="person-circle" size={30} color="white" />
          <Text style={styles.storySenderModal}>{viewingStory.username}</Text>
        </View>
        <TouchableOpacity onPress={closeStory} style={styles.closeButton}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* For modal viewing, we need to handle video playback differently */}
      {viewingStory.mediaType === 'video' ? (
        <Video
          source={{ uri: viewingStory.imageUrl }}
          style={styles.fullStoryImage}
          shouldPlay={true}
          isLooping={true}
          resizeMode="contain"
          isMuted={false}
          volume={0.8}
        />
      ) : (
        <SnapRenderer 
          imageUrl={viewingStory.imageUrl}
          imageData={viewingStory.imageData}
          metadata={viewingStory.metadata}
          containerStyle={styles.fullStoryContainer}
          imageStyle={styles.fullStoryImage}
        />
      )}
      
      <View style={styles.storyFooter}>
        <Text style={styles.timerText}>Closes automatically in 10s</Text>
      </View>
    </TouchableOpacity>
  )}
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContainer: {
    padding: 10,
  },
  storyItem: {
    width: imageSize,
    height: imageSize * 1.5,
    margin: 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  storyImageContainer: {
    width: '100%',
    height: '100%',
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
  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  storyTime: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
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
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  storyModal: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  storyHeader: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    zIndex: 1,
  },
  storyHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storySenderModal: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  fullStoryContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullStoryImage: {
    resizeMode: 'contain',
  },

  videoThumbnail: {
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  justifyContent: 'center',
  alignItems: 'center',
},

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  storyFooter: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  timerText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});