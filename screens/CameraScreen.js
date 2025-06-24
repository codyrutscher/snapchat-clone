import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { addDoc, collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { CaptionSuggestions, BestTimeIndicator, SmartFilterRecommendations } from '../components/AIAssistant';
import OpenAIService from '../services/OpenAIService';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db, storage } from '../firebase';

// ... rest of the CameraScreen.js file remains the same

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Filter definitions - these work on web with CSS filters
const FILTERS = [
  { id: 'none', name: 'None', icon: '🚫', style: {} },
  { id: 'grayscale', name: 'B&W', icon: '⚫', style: Platform.OS === 'web' ? { filter: 'grayscale(1)' } : {} },
  { id: 'sepia', name: 'Sepia', icon: '🟤', style: Platform.OS === 'web' ? { filter: 'sepia(1)' } : {} },
  { id: 'bright', name: 'Bright', icon: '💡', style: Platform.OS === 'web' ? { filter: 'brightness(1.3)' } : {} },
  { id: 'dark', name: 'Dark', icon: '🌙', style: Platform.OS === 'web' ? { filter: 'brightness(0.7)' } : {} },
  { id: 'contrast', name: 'Pop', icon: '🎨', style: Platform.OS === 'web' ? { filter: 'contrast(1.3)' } : {} },
  { id: 'saturate', name: 'Vivid', icon: '🌈', style: Platform.OS === 'web' ? { filter: 'saturate(1.5)' } : {} },
];

// Border styles
const BORDERS = [
  { id: 'none', name: 'None', style: {} },
  { id: 'white', name: 'White', style: { borderWidth: 20, borderColor: 'white' } },
  { id: 'black', name: 'Black', style: { borderWidth: 20, borderColor: 'black' } },
  { id: 'rounded', name: 'Rounded', style: { borderRadius: 30, overflow: 'hidden' } },
];

// Background patterns
const BACKGROUNDS = [
  { id: 'none', name: 'None', color: 'transparent' },
  { id: 'gradient1', name: 'Sunset', colors: ['#FF6B6B', '#FFE66D'] },
  { id: 'gradient2', name: 'Ocean', colors: ['#4ECDC4', '#44A08D'] },
  { id: 'gradient3', name: 'Purple', colors: ['#667eea', '#764ba2'] },
  { id: 'pattern1', name: 'Stars', emoji: '⭐', color: '#1a1a2e' },
  { id: 'pattern2', name: 'Hearts', emoji: '❤️', color: '#ffe0e0' },
  { id: 'pattern3', name: 'Rainbow', emoji: '🌈', color: '#e3f2fd' },
];

export default function CameraScreen() {
  const [facing, setFacing] = useState('back');
  const [hasPermission, setHasPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [sendAsStory, setSendAsStory] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [showAICaptions, setShowAICaptions] = useState(false);
  const [aiGeneratedCaption, setAIGeneratedCaption] = useState('');
  
  // New states for editing
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedBorder, setSelectedBorder] = useState('none');
  const [selectedBackground, setSelectedBackground] = useState('none');
  
  // Text overlay states
  const [snapText, setSnapText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: screenWidth / 2, y: screenHeight / 2 });
  
  // UI states for dropdowns
  const [activeMenu, setActiveMenu] = useState(null); // 'filters', 'borders', 'backgrounds', or null
  const slideAnim = useRef(new Animated.Value(-300)).current;
  
  const cameraRef = useRef(null);

  useEffect(() => {
  (async () => {
    try {
      // Request camera permission
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (Platform.OS !== 'web') {
        await MediaLibrary.requestPermissionsAsync();
      }

      loadFriends();
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  })();
  
  // Initialize OpenAI context
  try {
    OpenAIService.initializeUserContext();
  } catch (error) {
    console.log('OpenAI initialization skipped:', error.message);
  }
}, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        if (userData.friends && userData.friends.length > 0) {
          loadFriendDetails(userData.friends);
        } else {
          setFriends([]);
          setLoadingFriends(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Animate menu slide
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeMenu ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeMenu]);

  const loadFriends = async () => {
    try {
      setLoadingFriends(true);
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        
        if (friendIds.length > 0) {
          await loadFriendDetails(friendIds);
        } else {
          setFriends([]);
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setLoadingFriends(false);
    }
  };

  const loadFriendDetails = async (friendIds) => {
    try {
      const friendsData = [];
      
      for (const friendId of friendIds) {
        try {
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          if (friendDoc.exists()) {
            const friendData = friendDoc.data();
            friendsData.push({ 
              id: friendId, 
              ...friendData,
              displayName: friendData.username || friendData.displayName || 'Friend'
            });
          }
        } catch (error) {
          console.error(`Error loading friend ${friendId}:`, error);
        }
      }
      
      setFriends(friendsData);
    } catch (error) {
      console.error('Error loading friend details:', error);
    }
  };

  const onCameraReady = () => {
    setCameraReady(true);
  };

  const takePicture = async () => {
    if (cameraRef.current && cameraReady) {
      try {
        const options = {
          quality: 0.5,  // Balanced quality
          base64: false,
          exif: false,
          skipProcessing: true,
        };
        const photo = await cameraRef.current.takePictureAsync(options);
        
        // Resize image if it's too large
        if (Platform.OS === 'ios') {
          // iOS specific optimization
          setCapturedImage(photo.uri);
        } else {
          setCapturedImage(photo.uri);
        }
        
        setShowEditOptions(true);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  };

  const saveSnap = async () => {
  if (!capturedImage || !auth.currentUser) return;

  if (!sendAsStory && selectedFriends.length === 0) {
    Alert.alert('Error', 'Please select at least one friend or send as story');
    return;
  }

  setUploading(true);
  
  try {
    // Upload to Firebase Storage directly
    const response = await fetch(capturedImage);
    const blob = await response.blob();
    
    const filename = `snaps/${auth.currentUser.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    
    // Upload the blob
    await uploadBytes(storageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    const snapMetadata = {
      filter: selectedFilter,
      border: selectedBorder,
      background: selectedBackground,
      text: snapText,
      textPosition: textPosition
    };

    const promises = [];

    if (sendAsStory) {
      const storyData = {
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Anonymous',
        imageUrl: downloadURL,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'story',
        metadata: snapMetadata
      };
      
      promises.push(addDoc(collection(db, 'snaps'), storyData));
    }

    selectedFriends.forEach(friendId => {
      const snapData = {
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Anonymous',
        recipientId: friendId,
        imageUrl: downloadURL,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'direct',
        viewed: false,
        metadata: snapMetadata
      };
      
      promises.push(addDoc(collection(db, 'snaps'), snapData));
    });

    await Promise.all(promises);
    resetCamera();
    Alert.alert('Success', 'Snap sent!');
  } catch (error) {
    console.error('Upload error:', error);
    Alert.alert('Error', 'Failed to send snap: ' + error.message);
  } finally {
    setUploading(false);
  }
};

  const resetCamera = () => {
  setCapturedImage(null);
  setSelectedFriends([]);
  setSendAsStory(false);
  setShowFriendsList(false);
  setShowEditOptions(false);
  setSelectedFilter('none');
  setSelectedBorder('none');
  setSelectedBackground('none');
  setActiveMenu(null);
  setSnapText('');
  setShowTextInput(false);
  setTextPosition({ x: screenWidth / 2, y: screenHeight / 2 });
  
  // Force camera to remount
  setCameraReady(false);
  setTimeout(() => {
    setCameraReady(true);
  }, 100);
};

  const toggleFriendSelection = (friendId) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const selectAllFriends = () => {
    if (selectedFriends.length === friends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(friends.map(f => f.id));
    }
  };

  const toggleMenu = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const renderFriend = ({ item }) => {
    const isSelected = selectedFriends.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item.id)}
      >
        <Ionicons name="person-circle" size={40} color={Colors.primary} />
        <Text style={styles.friendName}>{item.displayName}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const getFilterStyle = () => {
    const filter = FILTERS.find(f => f.id === selectedFilter);
    return filter ? filter.style : {};
  };

  const getBorderStyle = () => {
    const border = BORDERS.find(b => b.id === selectedBorder);
    return border ? border.style : {};
  };

  const getBackgroundStyle = () => {
    const bg = BACKGROUNDS.find(b => b.id === selectedBackground);
    if (!bg || bg.id === 'none') return { backgroundColor: 'transparent' };
    
    if (bg.colors) {
      return { backgroundColor: bg.colors[0] };
    }
    return { backgroundColor: bg.color || 'transparent' };
  };

 if (hasPermission === null) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Requesting camera permission...</Text>
    </View>
  );
}

if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={80} color="#666" />
        <Text style={styles.text}>Camera permission denied</Text>
        <Text style={styles.subText}>
          Please enable camera access in your {Platform.OS === 'web' ? 'browser' : 'device'} settings
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={async () => {
  const { status } = await Camera.requestCameraPermissionsAsync();
  setHasPermission(status === 'granted');
}}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturedImage && showEditOptions) {
    const currentBackground = BACKGROUNDS.find(b => b.id === selectedBackground);
    
    return (
      <View style={styles.editContainer}>
        {/* Full screen preview with effects */}
        <View style={[styles.fullScreenPreview, getBackgroundStyle()]}>
          {currentBackground?.emoji && (
            <View style={styles.backgroundPatternContainer}>
              {Array(30).fill(0).map((_, i) => (
                <Text key={i} style={styles.backgroundPattern}>
                  {currentBackground.emoji}
                </Text>
              ))}
            </View>
          )}
          <View style={[styles.imageWrapper, getBorderStyle()]}>
            <Image 
              source={{ uri: capturedImage }} 
              style={[styles.previewImage, getFilterStyle()]}
              resizeMode="contain"
            />
          </View>
          {/* Text overlay */}
{snapText && (
  <TouchableOpacity 
    style={[styles.textOverlay, { top: textPosition.y - 50, left: 20, right: 20 }]}
    onPress={() => setShowTextInput(true)}
  >
    <Text style={styles.snapTextDisplay}>{snapText}</Text>
  </TouchableOpacity>
)}
        </View>

        {/* Top controls overlay */}
        <View style={styles.topControls}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={resetCamera}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <View style={styles.editMenuButtons}>
            <TouchableOpacity 
              style={[styles.menuButton, activeMenu === 'filters' && styles.activeMenuButton]}
              onPress={() => toggleMenu('filters')}
            >
              <Ionicons name="color-filter" size={24} color="white" />
              <Text style={styles.menuButtonText}>Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuButton, activeMenu === 'borders' && styles.activeMenuButton]}
              onPress={() => toggleMenu('borders')}
            >
              <Ionicons name="square-outline" size={24} color="white" />
              <Text style={styles.menuButtonText}>Borders</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuButton, activeMenu === 'backgrounds' && styles.activeMenuButton]}
              onPress={() => toggleMenu('backgrounds')}
            >
              <Ionicons name="color-palette" size={24} color="white" />
              <Text style={styles.menuButtonText}>BG</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setShowTextInput(true)}
            >
              <Ionicons name="text" size={24} color="white" />
              <Text style={styles.menuButtonText}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity 
  style={styles.menuButton}
  onPress={() => setShowAICaptions(true)}
>
  <Ionicons name="sparkles" size={24} color="white" />
  <Text style={styles.menuButtonText}>AI</Text>
</TouchableOpacity>
          </View>
        </View>

        {/* Sliding menu */}
        <Animated.View 
          style={[
            styles.slidingMenu,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {activeMenu === 'filters' && (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View style={styles.menuOptions}>
      <SmartFilterRecommendations
        imageAnalysis={{
          brightness: 'normal', // You can analyze the image here
          mood: 'casual',
          time: new Date().getHours()
        }}
        onSelectFilter={(filterId) => {
          setSelectedFilter(filterId);
          setActiveMenu(null);
        }}
        currentFilter={selectedFilter}
      />
    </View>
  </ScrollView>
)}

          {activeMenu === 'borders' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.menuOptions}>
                {BORDERS.map(border => (
                  <TouchableOpacity
                    key={border.id}
                    style={[
                      styles.optionItem,
                      selectedBorder === border.id && styles.selectedOption
                    ]}
                    onPress={() => setSelectedBorder(border.id)}
                  >
                    <View style={[styles.borderPreview, border.style]} />
                    <Text style={styles.optionName}>{border.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {activeMenu === 'backgrounds' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.menuOptions}>
                {BACKGROUNDS.map(bg => (
                  <TouchableOpacity
                    key={bg.id}
                    style={[
                      styles.optionItem,
                      selectedBackground === bg.id && styles.selectedOption
                    ]}
                    onPress={() => setSelectedBackground(bg.id)}
                  >
                    <View style={[
                      styles.bgPreview,
                      { backgroundColor: bg.color || bg.colors?.[0] || 'transparent' }
                    ]}>
                      {bg.emoji && <Text style={styles.bgEmoji}>{bg.emoji}</Text>}
                    </View>
                    <Text style={styles.optionName}>{bg.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </Animated.View>

        {/* Text input modal */}
        <Modal
          visible={showTextInput}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTextInput(false)}
        >
          <TouchableOpacity 
            style={styles.textInputOverlay} 
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setShowTextInput(false);
            }}
          >
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={snapText}
                onChangeText={setSnapText}
                placeholder="Add text..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                autoFocus
                maxLength={200}
                onSubmitEditing={() => setShowTextInput(false)}
              />
            </View>
          </TouchableOpacity>
        </Modal>


        {/* AI Caption Suggestions Modal */}
<Modal
  visible={showAICaptions}
  transparent={true}
  animationType="fade"
  onRequestClose={() => setShowAICaptions(false)}
>
  <TouchableOpacity 
    style={styles.textInputOverlay} 
    activeOpacity={1}
    onPress={() => setShowAICaptions(false)}
  >
    <View style={styles.aiCaptionContainer}>
      <Text style={styles.aiTitle}>AI Caption Suggestions</Text>
      <CaptionSuggestions 
        imageContext={{
          filter: selectedFilter,
          background: selectedBackground,
          border: selectedBorder,
          time: new Date().getHours(),
          mood: 'casual'
        }}
        onSelect={(caption) => {
          setSnapText(caption);
          setShowAICaptions(false);
          // Track usage for learning
          OpenAIService.updateContentFeedback('caption', { used: true, caption });
        }}
      />
    </View>
  </TouchableOpacity>
</Modal>

        {/* Bottom action button */}
        <View style={styles.bottomControls}>
  <BestTimeIndicator />
  <TouchableOpacity 
    style={styles.nextButton} 
    onPress={() => {
      setShowEditOptions(false);
      setShowFriendsList(true);
      setActiveMenu(null);
    }}
  >
    <Text style={styles.nextButtonText}>Next</Text>
    <Ionicons name="arrow-forward" size={20} color="white" />
  </TouchableOpacity>
</View>
</View>
    );
  }

  if (capturedImage && showFriendsList) {
    const currentBackground = BACKGROUNDS.find(b => b.id === selectedBackground);
    
    return (
      <View style={styles.container}>
        <View style={[styles.finalPreviewContainer, getBackgroundStyle()]}>
          {currentBackground?.emoji && (
            <View style={styles.backgroundPatternContainer}>
              {Array(30).fill(0).map((_, i) => (
                <Text key={i} style={styles.backgroundPattern}>
                  {currentBackground.emoji}
                </Text>
              ))}
            </View>
          )}
          <View style={[styles.finalImageWrapper, getBorderStyle()]}>
            <Image 
              source={{ uri: capturedImage }} 
              style={[styles.finalPreview, getFilterStyle()]} 
              resizeMode="contain"
            />
          </View>
        </View>
        
        <Modal
          visible={showFriendsList}
          animationType="slide"
          onRequestClose={() => setShowFriendsList(false)}
        >
          <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
  <TouchableOpacity onPress={() => {
    setShowFriendsList(false);
    setShowEditOptions(true);
  }}>
    <Ionicons name="arrow-back" size={30} color="#000" />
  </TouchableOpacity>
  <Text style={styles.modalTitle}>Send To...</Text>
  <TouchableOpacity 
    onPress={saveSnap} 
    disabled={uploading || (!sendAsStory && selectedFriends.length === 0)}
    style={styles.sendButton}
  >
    {uploading ? (
      <ActivityIndicator size="small" color={Colors.primary} />
    ) : (
      <Text style={[
        styles.sendButtonText, 
        (!sendAsStory && selectedFriends.length === 0) && styles.sendButtonTextDisabled
      ]}>
        Send
      </Text>
    )}
  </TouchableOpacity>
</View>

            <TouchableOpacity
              style={[styles.storyOption, sendAsStory && styles.storyOptionSelected]}
              onPress={() => setSendAsStory(!sendAsStory)}
            >
              <Ionicons name="images" size={40} color={Colors.primary} />
              <Text style={styles.storyText}>My Story</Text>
              {sendAsStory && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>

            <View style={styles.friendsHeader}>
              <Text style={styles.sectionTitle}>Send to Friends</Text>
              {friends.length > 0 && (
                <TouchableOpacity onPress={selectAllFriends}>
                  <Text style={styles.selectAllText}>
                    {selectedFriends.length === friends.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {loadingFriends ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.noFriendsContainer}>
                <Ionicons name="people-outline" size={60} color={Colors.gray} />
                <Text style={styles.noFriendsText}>
                  No friends yet. Add friends to send snaps!
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.friendsList}
              />
            )}

            {selectedFriends.length > 0 && (
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionText}>
                  {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''} selected
                </Text>
              </View>
            )}
          </View>
        </Modal>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
    {!capturedImage && cameraReady && (
      <Camera 
  style={styles.camera} 
  type={facing === 'back' ? Camera.Constants.Type.back : Camera.Constants.Type.front}
  ref={cameraRef}
  onCameraReady={onCameraReady}
>
        <View style={styles.cameraOverlay}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => {
              setFacing(current => (current === 'back' ? 'front' : 'back'));
            }}
          >
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </Camera>
    )}
      <View style={styles.bottomCameraControls}>
        <TouchableOpacity 
          style={[styles.captureButton, !cameraReady && styles.captureButtonDisabled]} 
          onPress={takePicture}
          disabled={!cameraReady}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  flipButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
  },
  bottomCameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  subText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Edit screen styles
  editContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  fullScreenPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundPatternContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundPattern: {
    fontSize: 30,
    margin: 10,
  },
  imageWrapper: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  
  // Top controls
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,  // More space for iOS notch
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
},
  closeButton: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
  editMenuButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  menuButton: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    minWidth: 60,
  },
  activeMenuButton: {
    backgroundColor: Colors.primary,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 10,
    marginTop: 2,
  },
  
  // Sliding menu
  slidingMenu: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 20,
    marginHorizontal: 10,
    padding: 15,
    zIndex: 5,
  },
  menuOptions: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 15,
  },
  optionItem: {
    alignItems: 'center',
    minWidth: 70,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  selectedOption: {
    backgroundColor: Colors.primary,
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  optionName: {
    color: 'white',
    fontSize: 12,
  },
  borderPreview: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 5,
  },
  bgPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  bgEmoji: {
    fontSize: 20,
  },
  
  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    gap: 10,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Final preview
  finalPreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  finalImageWrapper: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalPreview: {
    width: '100%',
    height: '100%',
  },
  
  // Modal styles (keeping existing)
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 60 : 15,  // Add space for iOS status bar
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
},
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sendButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButtonTextDisabled: {
    color: Colors.gray,
  },
  sendButton: {
    padding: 10,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  aiCaptionContainer: {
  backgroundColor: 'white',
  borderRadius: 20,
  padding: 20,
  margin: 20,
  maxHeight: '50%',
},
aiTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 15,
  textAlign: 'center',
},
  storyOptionSelected: {
    backgroundColor: Colors.primary + '10',
  },
  storyText: {
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f8f8f8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectAllText: {
    color: Colors.primary,
    fontSize: 14,
  },
  friendsList: {
    paddingBottom: 100,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  friendItemSelected: {
    backgroundColor: Colors.primary + '10',
  },
  friendName: {
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.gray,
  },
  noFriendsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  noFriendsText: {
    textAlign: 'center',
    color: Colors.gray,
    marginTop: 10,
    fontSize: 16,
  },
  selectionInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 15,
  },
  selectionText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  
  // Text overlay styles
  textOverlay: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  snapTextDisplay: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  textInputOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputContainer: {
    width: '80%',
    maxWidth: 400,
  },
  textInput: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    minHeight: 50,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});