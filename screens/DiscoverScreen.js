// screens/DiscoverScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import TrendingService from '../services/TrendingService';
import { auth, db } from '../firebase';
import SnapRenderer from '../components/SnapRenderer';
import { Video } from 'expo-av';
import { doc, updateDoc, query, where, getDocs, getDoc, collection } from 'firebase/firestore';

export default function DiscoverScreen({ navigation }) {
  const [trendingSnaps, setTrendingSnaps] = useState([]);
  const [nearbyContent, setNearbyContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('trending'); // 'trending' or 'nearby'
  const [viewingSnap, setViewingSnap] = useState(null);
  const [viewTimer, setViewTimer] = useState(null);

  useEffect(() => {
    loadContent();
    
    return () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, [activeTab]);

  const loadContent = async () => {
    setLoading(true);
    try {
      if (activeTab === 'trending') {
        const trending = await TrendingService.getTrendingSnaps();
        
        // Check which snaps the user has liked
        const snapsWithLikeStatus = await Promise.all(
          trending.map(async (snap) => {
            const likeQuery = query(
              collection(db, 'snapEngagement'),
              where('snapId', '==', snap.id),
              where('userId', '==', auth.currentUser.uid),
              where('type', '==', 'like')
            );
            const likeDocs = await getDocs(likeQuery);
            return {
              ...snap,
              userLiked: !likeDocs.empty
            };
          })
        );
        
        setTrendingSnaps(snapsWithLikeStatus);
      } else {
        const nearby = await TrendingService.getNearbyContent();
        
        // Check which snaps the user has liked
        const snapsWithLikeStatus = await Promise.all(
          nearby.map(async (snap) => {
            const likeQuery = query(
              collection(db, 'snapEngagement'),
              where('snapId', '==', snap.id),
              where('userId', '==', auth.currentUser.uid),
              where('type', '==', 'like')
            );
            const likeDocs = await getDocs(likeQuery);
            return {
              ...snap,
              userLiked: !likeDocs.empty
            };
          })
        );
        
        setNearbyContent(snapsWithLikeStatus);
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContent();
    setRefreshing(false);
  };

  const viewSnap = async (snap) => {
    setViewingSnap(snap);
    
    // Track view start time
    const startTime = Date.now();
    
    // Record view engagement
    await TrendingService.recordEngagement(snap.id, 'view');
    
    // Update view count in the snap document
    try {
      const snapRef = doc(db, 'snaps', snap.id);
      const snapDoc = await getDoc(snapRef);
      
      if (snapDoc.exists()) {
        const currentViews = snapDoc.data().views || 0;
        await updateDoc(snapRef, {
          views: currentViews + 1
        });
      }
    } catch (error) {
      console.error('Error updating view count:', error);
    }
    
    // Auto-close after 10 seconds
    const timer = setTimeout(async () => {
      const duration = (Date.now() - startTime) / 1000;
      await TrendingService.trackUserBehavior('view_snap', {
        snapId: snap.id,
        duration: duration
      });
      setViewingSnap(null);
    }, 10000);
    
    setViewTimer(timer);
  };

  const closeSnap = async () => {
    if (viewTimer) {
      clearTimeout(viewTimer);
    }
    setViewingSnap(null);
  };

  const likeSnap = async (snap) => {
  try {
    // Check if already liked
    const engagementQuery = query(
      collection(db, 'snapEngagement'),
      where('snapId', '==', snap.id),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'like')
    );
    
    const existingLike = await getDocs(engagementQuery);
    
    if (!existingLike.empty) {
      Alert.alert('Already Liked', 'You have already liked this snap');
      return;
    }
    
    // Record the like in snapEngagement collection
    await TrendingService.recordEngagement(snap.id, 'like');
    
    // Update like count in the snap document
    try {
      const snapRef = doc(db, 'snaps', snap.id);
      const snapDoc = await getDoc(snapRef);
      
      if (snapDoc.exists()) {
        const currentLikes = snapDoc.data().likes || 0;
        const newLikeCount = currentLikes + 1;
        
        await updateDoc(snapRef, {
          likes: newLikeCount
        });
        
        // Update the viewing snap modal immediately
        setViewingSnap({
          ...viewingSnap,
          likes: newLikeCount,
          engagement: {
            ...viewingSnap.engagement,
            likes: newLikeCount
          },
          userLiked: true
        });
        
        // Update the grid view immediately
        if (activeTab === 'trending') {
          setTrendingSnaps(prevSnaps => 
            prevSnaps.map(s => 
              s.id === snap.id 
                ? { ...s, likes: newLikeCount, userLiked: true }
                : s
            )
          );
        } else {
          setNearbyContent(prevContent => 
            prevContent.map(s => 
              s.id === snap.id 
                ? { ...s, likes: newLikeCount, userLiked: true }
                : s
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating like count:', error);
      Alert.alert('Error', 'Failed to update like count');
      return;
    }
    
    // Track behavior for AI recommendations
    await TrendingService.trackUserBehavior('like_content', {
      contentId: snap.id
    });
    
  } catch (error) {
    console.error('Error liking snap:', error);
    Alert.alert('Error', 'Failed to like snap');
  }
};

  const renderSnapItem = ({ item }) => (
  <TouchableOpacity style={styles.snapItem} onPress={() => viewSnap(item)}>
    <View style={styles.snapThumbnail}>
      {item.mediaType === 'video' ? (
        <View style={styles.videoThumbnail}>
          <Ionicons name="play-circle" size={40} color="white" />
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
          )}
        </View>
      ) : (
        <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
      )}
      {item.userLiked && (
        <View style={styles.likedIndicator}>
          <Ionicons name="heart" size={16} color="#FF6B6B" />
        </View>
      )}
    </View>
    <View style={styles.snapInfo}>
      <Text style={styles.snapUsername}>{item.username}</Text>
      {activeTab === 'trending' ? (
        <View style={styles.engagementRow}>
          <Ionicons name="eye" size={16} color={Colors.gray} />
          <Text style={styles.engagementText}>{item.views || 0}</Text>
          <Ionicons name="heart" size={16} color={Colors.gray} style={{ marginLeft: 10 }} />
          <Text style={styles.engagementText}>{item.likes || 0}</Text>
        </View>
      ) : (
        <Text style={styles.distanceText}>{item.distance} km away</Text>
      )}
    </View>
  </TouchableOpacity>
);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
            onPress={() => setActiveTab('trending')}
          >
            <Ionicons name="trending-up" size={20} color={activeTab === 'trending' ? Colors.primary : Colors.gray} />
            <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>Trending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'nearby' && styles.activeTab]}
            onPress={() => setActiveTab('nearby')}
          >
            <Ionicons name="location" size={20} color={activeTab === 'nearby' ? Colors.primary : Colors.gray} />
            <Text style={[styles.tabText, activeTab === 'nearby' && styles.activeTabText]}>Nearby</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {activeTab === 'trending' ? 'Loading trending content...' : 'Finding nearby snaps...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'trending' ? trendingSnaps : nearbyContent}
          renderItem={renderSnapItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={activeTab === 'trending' ? 'trending-up-outline' : 'location-outline'} 
                size={60} 
                color={Colors.gray} 
              />
              <Text style={styles.emptyText}>
                {activeTab === 'trending' ? 'No trending content yet' : 'No nearby content found'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'trending' ? 'Be the first to create trending content!' : 'Enable location to see nearby snaps'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Snap Viewer Modal */}
      <Modal
  visible={viewingSnap !== null}
  animationType="fade"
  onRequestClose={closeSnap}
>
  {viewingSnap && (
    <View style={styles.snapModal}>
      <TouchableOpacity 
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={closeSnap}
      />
      
      <View style={styles.snapHeader}>
        <View style={styles.snapHeaderInfo}>
          <Ionicons name="person-circle" size={30} color="white" />
          <Text style={styles.snapSenderModal}>{viewingSnap.username}</Text>
        </View>
        <TouchableOpacity onPress={closeSnap} style={styles.closeButton}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
      
      <SnapRenderer 
        imageUrl={viewingSnap.imageUrl}
        metadata={viewingSnap.metadata}
        containerStyle={styles.fullSnapContainer}
        imageStyle={styles.fullSnapImage}
      />
      
      <View style={styles.snapActions}>
        <TouchableOpacity 
          style={[
            styles.actionButton,
            viewingSnap.userLiked && styles.actionButtonLiked
          ]}
          onPress={() => likeSnap(viewingSnap)}
          disabled={viewingSnap.userLiked}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={viewingSnap.userLiked ? "heart" : "heart-outline"} 
            size={28} 
            color={viewingSnap.userLiked ? "#FF6B6B" : "white"} 
          />
          <Text style={[
            styles.actionText,
            viewingSnap.userLiked && styles.likedText
          ]}>
            {viewingSnap.likes || 0} Likes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add this new standalone like button */}
<View style={styles.likeButtonContainer}>
  <TouchableOpacity 
    style={[
      styles.bigLikeButton,
      viewingSnap.userLiked && styles.bigLikeButtonLiked
    ]}
    onPress={() => {
      console.log('Like button pressed!'); // Debug log
      likeSnap(viewingSnap);
    }}
    disabled={viewingSnap.userLiked}
  >
    <Ionicons 
      name={viewingSnap.userLiked ? "heart" : "heart-outline"} 
      size={32} 
      color="white" 
    />
    <Text style={styles.bigLikeButtonText}>
      {viewingSnap.userLiked ? 'Liked' : 'Like'} ({viewingSnap.likes || 0})
    </Text>
  </TouchableOpacity>
</View>
      
      <View style={styles.snapFooter}>
        <Text style={styles.timerText}>Closes automatically in 10s</Text>
      </View>
    </View>
  )}
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: Colors.gray,
    marginLeft: 5,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
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
  gridContainer: {
    padding: 10,
  },
  snapItem: {
    flex: 1,
    margin: 5,
    backgroundColor: Colors.white,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  snapThumbnail: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.lightGray,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.black,
  },
  likedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  snapInfo: {
    padding: 10,
  },
  snapUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.black,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  engagementText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 3,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 5,
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
  // Modal styles
  snapModal: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  snapHeader: {
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
  snapHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapSenderModal: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  fullSnapContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullSnapImage: {
    resizeMode: 'contain',
  },
  snapActions: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    paddingHorizontal: 25,
    paddingVertical: 12,
  },
  actionButtonLiked: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
    fontWeight: 'bold',
  },
  likedText: {
    color: '#FF6B6B',
  },
  snapFooter: {
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
  likeButtonContainer: {
  position: 'absolute',
  bottom: 150,
  left: 0,
  right: 0,
  alignItems: 'center',
},
bigLikeButton: {
  backgroundColor: '#FF6B6B',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 30,
  paddingVertical: 15,
  borderRadius: 30,
  gap: 10,
},
bigLikeButtonLiked: {
  backgroundColor: '#666',
},
bigLikeButtonText: {
  color: 'white',
  fontSize: 18,
  fontWeight: 'bold',
}
});