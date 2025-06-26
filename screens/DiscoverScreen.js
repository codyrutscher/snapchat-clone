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
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import TrendingService from '../services/TrendingService';
import { auth, db } from '../firebase';
import SnapRenderer from '../components/SnapRenderer';
import { Video } from 'expo-av';
import { doc, updateDoc, query, where, getDocs, getDoc, collection, orderBy, limit } from 'firebase/firestore';

export default function DiscoverScreen({ navigation }) {
  const [trendingSnaps, setTrendingSnaps] = useState([]);
  const [nearbyContent, setNearbyContent] = useState([]);
  const [codeContent, setCodeContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('trending'); // 'trending', 'nearby', or 'code'
  const [viewingSnap, setViewingSnap] = useState(null);
  const [viewTimer, setViewTimer] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [showLanguageFilter, setShowLanguageFilter] = useState(false);

  const LANGUAGES = [
    { id: 'all', name: 'All Languages' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'react', name: 'React' },
    { id: 'go', name: 'Go' },
    { id: 'rust', name: 'Rust' },
    { id: 'cpp', name: 'C++' },
    { id: 'csharp', name: 'C#' },
  ];

  useEffect(() => {
    loadContent();
    
    return () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, [activeTab, selectedLanguage]);

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
      } else if (activeTab === 'nearby') {
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
      } else if (activeTab === 'code') {
        // Load code stories
        const codeStories = await loadCodeStories();
        setCodeContent(codeStories);
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCodeStories = async () => {
  try {
    const now = new Date();
    
    console.log('Loading code stories with language filter:', selectedLanguage);
    
    // First get all code stories without ordering
    let q = query(
      collection(db, 'snaps'),
      where('type', '==', 'story'),
      where('contentType', '==', 'code')
    );

    const snapshot = await getDocs(q);
    const codeStories = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      console.log('Story data:', {
        id: doc.id,
        language: data.language,
        title: data.title,
        contentType: data.contentType
      });
      
      // Skip expired stories
      if (new Date(data.expiresAt) < now) continue;
      
      // Filter by language if not 'all'
      if (selectedLanguage !== 'all' && data.language !== selectedLanguage) {
        console.log(`Filtering out ${data.language} story because selected is ${selectedLanguage}`);
        continue; // Skip this story if it doesn't match the selected language
      }
      
      // Check if user liked
      const likeQuery = query(
        collection(db, 'snapEngagement'),
        where('snapId', '==', doc.id),
        where('userId', '==', auth.currentUser.uid),
        where('type', '==', 'like')
      );
      const likeDocs = await getDocs(likeQuery);
      
      codeStories.push({
        id: doc.id,
        ...data,
        userLiked: !likeDocs.empty
      });
    }
    
    console.log(`Found ${codeStories.length} ${selectedLanguage} stories`);
    
    // Sort by timestamp on the client side
    codeStories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return codeStories;
  } catch (error) {
    console.error('Error loading code stories:', error);
    return [];
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

  const viewCodeSnippet = async (snippet) => {
    // Navigate to code editor with the snippet
    navigation.navigate('CodeEditor', {
      sharedSnippet: {
        code: snippet.code,
        language: snippet.language,
        title: snippet.title,
        description: snippet.description
      }
    });
    
    // Record view
    await TrendingService.recordEngagement(snippet.id, 'view');
    
    // Update view count
    try {
      const snapRef = doc(db, 'snaps', snippet.id);
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

  const renderCodeItem = ({ item }) => (
    <TouchableOpacity style={styles.codeItem} onPress={() => viewCodeSnippet(item)}>
      <View style={styles.codeItemHeader}>
        <View style={styles.languageBadge}>
          <Text style={styles.languageBadgeText}>{item.language}</Text>
        </View>
        {item.userLiked && (
          <Ionicons name="heart" size={16} color="#FF6B6B" />
        )}
      </View>
      <Text style={styles.codeTitle} numberOfLines={1}>
        {item.title || 'Untitled'}
      </Text>
      <Text style={styles.codeDescription} numberOfLines={2}>
        {item.description || `${item.metadata?.linesOfCode || 0} lines of ${item.language} code`}
      </Text>
      <View style={styles.codeStats}>
        <View style={styles.statItem}>
          <Ionicons name="eye" size={14} color={Colors.gray} />
          <Text style={styles.statText}>{item.views || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={14} color={Colors.gray} />
          <Text style={styles.statText}>{item.likes || 0}</Text>
        </View>
        <Text style={styles.codeAuthor}>by {item.username}</Text>
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
          <TouchableOpacity
            style={[styles.tab, activeTab === 'code' && styles.activeTab]}
            onPress={() => {
              setActiveTab('code');
              setShowLanguageFilter(true);
            }}
          >
            <Ionicons name="code-slash" size={20} color={activeTab === 'code' ? Colors.primary : Colors.gray} />
            <Text style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}>Code</Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'code' && (
          <TouchableOpacity
            style={styles.languageFilterButton}
            onPress={() => setShowLanguageFilter(true)}
          >
            <Text style={styles.languageFilterText}>
              {LANGUAGES.find(l => l.id === selectedLanguage)?.name || 'All Languages'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {activeTab === 'trending' ? 'Loading trending content...' : activeTab === 'nearby' ? 'Finding nearby snaps...' : 'Loading code snippets...'}
          </Text>
        </View>
      ) : (
        activeTab === 'code' ? (
          <FlatList
            key="code-list"
            data={codeContent}
            renderItem={renderCodeItem}
            keyExtractor={(item) => item.id}
            numColumns={1}
            contentContainerStyle={styles.codeListContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="code-slash-outline" size={60} color={Colors.gray} />
                <Text style={styles.emptyText}>No code snippets yet</Text>
                <Text style={styles.emptySubtext}>Be the first to share code!</Text>
              </View>
            )}
          />
        ) : (
          <FlatList
            key="snap-grid"
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
        )
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

            <View style={styles.likeButtonContainer}>
              <TouchableOpacity 
                style={[
                  styles.bigLikeButton,
                  viewingSnap.userLiked && styles.bigLikeButtonLiked
                ]}
                onPress={() => {
                  console.log('Like button pressed!');
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

      {/* Language Filter Modal */}
      <Modal
        visible={showLanguageFilter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageFilter(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguageFilter(false)}
        >
          <View style={styles.languageFilterModal}>
            <Text style={styles.languageModalTitle}>Filter by Language</Text>
            <ScrollView>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.id && styles.selectedLanguageOption
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang.id);
                    setShowLanguageFilter(false);
                    loadContent(); // Reload with new filter
                  }}
                >
                  <Text style={[
                    styles.languageOptionText,
                    selectedLanguage === lang.id && styles.selectedLanguageText
                  ]}>
                    {lang.name}
                  </Text>
                  {selectedLanguage === lang.id && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
  languageFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary + '10',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    alignSelf: 'center',
  },
  languageFilterText: {
    color: Colors.primary,
    marginRight: 5,
    fontWeight: '600',
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
  codeListContainer: {
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
  codeItem: {
    backgroundColor: Colors.white,
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  codeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  languageBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  languageBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
    marginBottom: 5,
  },
  codeDescription: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 10,
  },
  codeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  statText: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 3,
  },
  codeAuthor: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 'auto',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  languageFilterModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  languageModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  selectedLanguageOption: {
    backgroundColor: Colors.primary + '10',
  },
  languageOptionText: {
    fontSize: 16,
    color: Colors.black,
  },
  selectedLanguageText: {
    color: Colors.primary,
    fontWeight: '600',
  },
});