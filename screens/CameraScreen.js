import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video } from 'expo-av';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db, storage } from '../firebase';
import { CaptionSuggestions } from '../components/AIAssistant';
import OpenAIService from '../services/OpenAIService';
import ContentModerationService from '../services/ContentModerationService';
import TrendingService from '../services/TrendingService';
import SubscriptionService from '../services/SubscriptionService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Platform-specific delays
const CAMERA_INIT_DELAY = Platform.select({
  ios: 300,
  android: 500,
  web: 1000,
});

// Simple borders
const BORDERS = [
  { id: 'none', name: 'None', style: {} },
  { id: 'white', name: 'White', style: { borderWidth: 15, borderColor: 'white' } },
  { id: 'black', name: 'Black', style: { borderWidth: 15, borderColor: 'black' } },
  { id: 'rounded', name: 'Rounded', style: { borderRadius: 20, overflow: 'hidden' } },
];

// Simple backgrounds
const BACKGROUNDS = [
  { id: 'none', name: 'None', color: 'transparent' },
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'black', name: 'Black', color: '#000000' },
  { id: 'purple', name: 'Purple', color: '#6B5CFF' },
  { id: 'pink', name: 'Pink', color: '#FF6B6B' },
  { id: 'blue', name: 'Blue', color: '#4ECDC4' },
];

export default function CameraScreen({ navigation }) {
  // Use the camera permissions hook
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  
  // Camera states
  const [cameraType, setCameraType] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  
  // Media states
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  
  // Editing states
  const [selectedBorder, setSelectedBorder] = useState('none');
  const [selectedBackground, setSelectedBackground] = useState('none');
  const [showEditOptions, setShowEditOptions] = useState(false);
  
  // Sending states
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [sendAsStory, setSendAsStory] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Caption states
  const [snapText, setSnapText] = useState('');
  const [showAICaptions, setShowAICaptions] = useState(false);
  const [captionText, setCaptionText] = useState('');
  
  const cameraRef = useRef(null);

  // Initialize camera when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isFocused && !capturedMedia) {
        console.log('Screen focused, initializing camera...');
        initializeCamera();
      }
      
      return () => {
        console.log('Screen unfocused, cleaning up...');
        if (!capturedMedia) {
          setShowCamera(false);
          setCameraReady(false);
        }
      };
    }, [isFocused, capturedMedia])
  );

  useEffect(() => {
    // Load friends
    loadFriends();
    
    // Request media library permissions for non-web platforms
    if (Platform.OS !== 'web') {
      MediaLibrary.requestPermissionsAsync();
    }
  }, []);

  const initializeCamera = async () => {
    try {
      console.log('Initializing camera...');
      setCameraError(false);
      setCameraInitializing(true);
      setCameraReady(false);
      
      // Force camera to remount by changing key
      setCameraKey(prev => prev + 1);
      
      // Small delay to ensure proper initialization
      await new Promise(resolve => setTimeout(resolve, CAMERA_INIT_DELAY));
      
      setShowCamera(true);
      setCameraInitializing(false);
    } catch (error) {
      console.error('Camera initialization error:', error);
      setCameraError(true);
      setCameraInitializing(false);
    }
  };

  const loadFriends = async () => {
    if (!auth.currentUser) return;
    
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
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) {
      console.log('Camera not ready yet');
      Alert.alert('Camera Not Ready', 'Please wait for the camera to initialize or press the refresh button.');
      return;
    }
    
    try {
      // Add a small delay to ensure camera is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
      });
      setCapturedMedia(photo.uri);
      setMediaType('photo');
      setShowEditOptions(true);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try reinitializing the camera.');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.3,
    });

    if (!result.canceled) {
      setCapturedMedia(result.assets[0].uri);
      setMediaType('uploaded');
      setShowEditOptions(true);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.3,
      videoExportPreset: ImagePicker.VideoExportPreset.LowQuality,
      videoMaxDuration: 15,
    });

    if (!result.canceled) {
      setCapturedMedia(result.assets[0].uri);
      setMediaType('video');
      setShowEditOptions(true);
    }
  };

  const flipCamera = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const resetCamera = () => {
    setCapturedMedia(null);
    setMediaType(null);
    setShowEditOptions(false);
    setShowFriendsList(false);
    setSelectedBorder('none');
    setSelectedBackground('none');
    setSelectedFriends([]);
    setSendAsStory(false);
    setSnapText('');
    setShowAICaptions(false);
    setCaptionText('');
    // Reinitialize camera when going back
    initializeCamera();
  };

  const saveSnap = async () => {
    if (!capturedMedia || !auth.currentUser) return;
    
    if (!sendAsStory && selectedFriends.length === 0) {
      Alert.alert('Error', 'Please select at least one friend or send as story');
      return;
    }

    setUploading(true);
    
    try {
      // Check subscription limits
      const canSend = await SubscriptionService.canSendContent(sendAsStory ? 'story' : 'snap');
      
      if (!canSend) {
        Alert.alert(
          'Limit Reached', 
          'You\'ve reached your monthly limit. Upgrade to DevChat Pro for unlimited content!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Profile') }
          ]
        );
        setUploading(false);
        return;
      }

      // Moderate caption if present
      if (snapText) {
        const moderationResult = await ContentModerationService.moderateText(snapText);
        if (moderationResult.flagged) {
          Alert.alert('Content Blocked', `Your caption was blocked: ${moderationResult.reason}`);
          setUploading(false);
          return;
        }
      }

      // Get location if permission granted
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          location = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude
          };
        }
      } catch (error) {
        console.log('Location error:', error);
      }

      // Prepare all data first
      const snapMetadata = {
        border: selectedBorder,
        background: selectedBackground,
        mediaType: mediaType,
        text: snapText
      };

      const timestamp = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      // Upload media in background while preparing database entries
      const uploadPromise = (async () => {
        const response = await fetch(capturedMedia);
        const blob = await response.blob();
        
        const filename = `snaps/${auth.currentUser.uid}/${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
      })();

      // Prepare all database entries while upload is happening
      const dbEntries = [];
      
      if (sendAsStory) {
        dbEntries.push({
          userId: auth.currentUser.uid,
          username: auth.currentUser.displayName || 'Anonymous',
          timestamp: timestamp,
          expiresAt: expiresAt,
          type: 'story',
          metadata: snapMetadata,
          location: location,
          // Add these fields for trending
          views: 0,
          likes: 0,
          shares: 0,
          public: true // Make stories public for discovery
        });
      }

      selectedFriends.forEach(friendId => {
        dbEntries.push({
          userId: auth.currentUser.uid,
          username: auth.currentUser.displayName || 'Anonymous',
          recipientId: friendId,
          timestamp: timestamp,
          expiresAt: expiresAt,
          type: 'direct',
          viewed: false,
          metadata: snapMetadata,
          location: location
        });
      });

      // Wait for upload to complete
      const downloadURL = await uploadPromise;

      // Add imageUrl to all entries and save to database in parallel
      const savePromises = dbEntries.map(entry => 
        addDoc(collection(db, 'snaps'), { ...entry, imageUrl: downloadURL })
      );

      await Promise.all(savePromises);
      
      // Increment content count after successful upload
      await SubscriptionService.incrementContentCount(sendAsStory ? 'story' : 'snap');
      
      // Track user behavior for story posts
      if (sendAsStory) {
        await TrendingService.trackUserBehavior('post_story', {
          mediaType: mediaType,
          hasCaption: !!snapText,
          hasLocation: !!location
        });
      }
      
      // Don't wait for alert, just reset immediately
      resetCamera();
      
      // Show success in background
      setTimeout(() => {
        Alert.alert('Success', 'Snap sent!');
      }, 100);
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to send snap: ' + error.message);
      setUploading(false);
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

  const getBorderStyle = () => {
    const border = BORDERS.find(b => b.id === selectedBorder);
    return border ? border.style : {};
  };

  const getBackgroundStyle = () => {
    const bg = BACKGROUNDS.find(b => b.id === selectedBackground);
    return { backgroundColor: bg ? bg.color : 'transparent' };
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Edit screen
  if (capturedMedia && showEditOptions) {
    return (
      <KeyboardAvoidingView 
        style={styles.editContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.previewContainer, getBackgroundStyle()]}>
          <View style={[styles.mediaWrapper, getBorderStyle()]}>
            {mediaType === 'video' ? (
              <Video
                source={{ uri: capturedMedia }}
                style={styles.previewImage}
                shouldPlay
                isLooping
                resizeMode="contain"
                isMuted={false}
                volume={0.5}
              />
            ) : (
              <Image source={{ uri: capturedMedia }} style={styles.previewImage} />
            )}
          </View>
          
          {/* Caption overlay */}
          {captionText && (
            <View style={styles.captionOverlay}>
              <Text style={styles.captionText}>{captionText}</Text>
            </View>
          )}
        </View>

        <View style={styles.editControls}>
          <TouchableOpacity style={styles.closeButton} onPress={resetCamera}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => {
              setSnapText(captionText); // Save caption to snapText
              setShowEditOptions(false);
              setShowFriendsList(true);
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionsContainer}>
          {/* Caption Section */}
          <View style={styles.captionSection}>
            <Text style={styles.optionTitle}>Caption</Text>
            
            {/* Manual caption input */}
            <View style={styles.captionInputContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                value={captionText}
                onChangeText={setCaptionText}
                multiline
                maxLength={100}
              />
              {captionText.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearCaptionButton}
                  onPress={() => setCaptionText('')}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.gray} />
                </TouchableOpacity>
              )}
            </View>

            {/* AI Caption Suggestions */}
            <CaptionSuggestions
              imageContext={{
                filter: selectedBorder,
                background: selectedBackground,
                border: selectedBorder,
                time: new Date().getHours(),
                mood: 'casual',
                mediaType: mediaType
              }}
              onSelect={(caption) => {
                setCaptionText(caption);
                OpenAIService.updateContentFeedback('caption', { used: true, caption });
              }}
            />
          </View>

          <View style={styles.optionsSection}>
            <Text style={styles.optionTitle}>Borders</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BORDERS.map(border => (
                <TouchableOpacity
                  key={border.id}
                  style={[styles.optionItem, selectedBorder === border.id && styles.selectedOption]}
                  onPress={() => setSelectedBorder(border.id)}
                >
                  <View style={[styles.borderPreview, border.style]} />
                  <Text style={styles.optionName}>{border.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.optionsSection}>
            <Text style={styles.optionTitle}>Backgrounds</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BACKGROUNDS.map(bg => (
                <TouchableOpacity
                  key={bg.id}
                  style={[styles.optionItem, selectedBackground === bg.id && styles.selectedOption]}
                  onPress={() => setSelectedBackground(bg.id)}
                >
                  <View style={[styles.bgPreview, { backgroundColor: bg.color }]} />
                  <Text style={styles.optionName}>{bg.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Send screen
  if (capturedMedia && showFriendsList) {
    return (
      <Modal visible={showFriendsList} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowFriendsList(false);
              setShowEditOptions(true);
            }}>
              <Ionicons name="arrow-back" size={30} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send To</Text>
            <TouchableOpacity 
              onPress={saveSnap} 
              disabled={uploading || (!sendAsStory && selectedFriends.length === 0)}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.storyOption, sendAsStory && styles.storyOptionSelected]}
            onPress={() => setSendAsStory(!sendAsStory)}
          >
            <Ionicons name="images" size={30} color={Colors.primary} />
            <Text style={styles.storyText}>My Story</Text>
            {sendAsStory && <Ionicons name="checkmark" size={24} color={Colors.primary} />}
          </TouchableOpacity>

          <Text style={styles.friendsTitle}>Friends</Text>
          <FlatList
            data={friends}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.friendItem, selectedFriends.includes(item.id) && styles.friendSelected]}
                onPress={() => toggleFriendSelection(item.id)}
              >
                <Ionicons name="person-circle" size={40} color={Colors.primary} />
                <Text style={styles.friendName}>{item.username || item.displayName}</Text>
                {selectedFriends.includes(item.id) && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noFriendsText}>No friends yet</Text>
            }
          />
        </View>
      </Modal>
    );
  }

  // Camera screen
  return (
    <View style={styles.container}>
      {(cameraError || !showCamera) ? (
        <View style={styles.errorContainer}>
          <Ionicons name="camera-off" size={60} color="white" />
          <Text style={styles.errorText}>
            {cameraError ? 'Camera failed to load' : 'Camera needs initialization'}
          </Text>
          <TouchableOpacity 
            style={styles.initButton}
            onPress={initializeCamera}
            disabled={cameraInitializing}
          >
            {cameraInitializing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="refresh" size={24} color="white" />
                <Text style={styles.initButtonText}>Initialize Camera</Text>
              </>
            )}
          </TouchableOpacity>
          
          <View style={styles.alternativeOptions}>
            <Text style={styles.orText}>Or use:</Text>
            <View style={styles.alternativeButtons}>
              <TouchableOpacity style={styles.altButton} onPress={pickImage}>
                <Ionicons name="images" size={30} color="white" />
                <Text style={styles.altButtonText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.altButton} onPress={pickVideo}>
                <Ionicons name="videocam" size={30} color="white" />
                <Text style={styles.altButtonText}>Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <>
          {showCamera && (
            <CameraView 
              key={cameraKey}
              style={styles.camera} 
              facing={cameraType}
              ref={cameraRef}
              onCameraReady={() => {
                console.log('Camera is ready');
                setCameraReady(true);
                setCameraInitializing(false);
              }}
              onMountError={(error) => {
                console.error('Camera mount error:', error);
                setCameraError(true);
                setCameraInitializing(false);
              }}
            >
              <View style={styles.cameraControls}>
                <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
                  <Ionicons name="camera-reverse" size={30} color="white" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.refreshButton} 
                  onPress={initializeCamera}
                  disabled={cameraInitializing}
                >
                  <Ionicons name="refresh" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </CameraView>
          )}

          {cameraInitializing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>Initializing camera...</Text>
            </View>
          )}

          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
              <Ionicons name="images" size={30} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.captureButton, !cameraReady && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={!cameraReady}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.galleryButton} onPress={pickVideo}>
              <Ionicons name="videocam" size={30} color="white" />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {cameraReady ? 'Tap center for photo • Use icons for gallery/video' : 'Waiting for camera...'}
          </Text>
        </>
      )}
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
  cameraControls: {
    position: 'absolute',
    top: 50,
    right: 20,
    alignItems: 'flex-end',
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
    marginBottom: 10,
  },
  refreshButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 50,
  },
  galleryButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    padding: 5,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    flex: 1,
    borderRadius: 35,
    backgroundColor: 'white',
  },
  hint: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    color: 'white',
    fontSize: 12,
    opacity: 0.7,
  },
  text: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginVertical: 20,
    textAlign: 'center',
  },
  initButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  initButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  alternativeOptions: {
    marginTop: 40,
    alignItems: 'center',
  },
  orText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 20,
    opacity: 0.7,
  },
  alternativeButtons: {
    flexDirection: 'row',
    gap: 30,
  },
  altButton: {
    alignItems: 'center',
    padding: 15,
  },
  altButtonText: {
    color: 'white',
    marginTop: 5,
    fontSize: 14,
  },
  
  // Edit screen styles
  editContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 200,
  },
  mediaWrapper: {
    width: '85%',
    height: '70%',
    maxWidth: 350,
    maxHeight: 500,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  editControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  optionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingTop: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  optionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  optionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  optionItem: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
  },
  selectedOption: {
    backgroundColor: 'rgba(107, 92, 255, 0.3)',
    borderRadius: 10,
  },
  borderPreview: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 5,
  },
  bgPreview: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginBottom: 5,
  },
  optionName: {
    color: 'white',
    fontSize: 12,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 25,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Caption styles
  captionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  captionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  captionInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.black,
  },
  clearCaptionButton: {
    padding: 5,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  captionText: {
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
  
  // Send modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sendText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  storyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  storyOptionSelected: {
    backgroundColor: Colors.primary + '10',
  },
  storyText: {
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f8f8f8',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  friendSelected: {
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
  },
});