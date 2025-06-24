import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Video } from 'expo-av';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db, storage } from '../firebase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

export default function CameraScreen() {
  // Use the camera permissions hook
  const [permission, requestPermission] = useCameraPermissions();
  
  // Camera states
  const [cameraType, setCameraType] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  
  // Media states
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'photo', 'video', or 'uploaded'
  
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
  
  const cameraRef = useRef(null);

  useEffect(() => {
    // Load friends
    loadFriends();
    
    // Request media library permissions for non-web platforms
    if (Platform.OS !== 'web') {
      MediaLibrary.requestPermissionsAsync();
    }
  }, []);

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
    if (cameraRef.current && cameraReady) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: false,
        });
        setCapturedMedia(photo.uri);
        setMediaType('photo');
        setShowEditOptions(true);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.7,
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
    quality: 0.5, // Reduced quality for smaller file size
    videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality, // Compress video
    videoMaxDuration: 30, // 30 seconds max
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
  };

  const saveSnap = async () => {
  if (!capturedMedia || !auth.currentUser) return;
  
  if (!sendAsStory && selectedFriends.length === 0) {
    Alert.alert('Error', 'Please select at least one friend or send as story');
    return;
  }

  setUploading(true);
  
  try {
    let mediaUri = capturedMedia;
    
    // Compress video if it's a video
    if (mediaType === 'video') {
      try {
        // For videos, we'll use ImageManipulator to create a thumbnail
        // and store video URL directly (Firebase will handle streaming)
        console.log('Processing video for upload...');
      } catch (error) {
        console.log('Video processing error:', error);
      }
    }
    
    // Upload media to Firebase Storage
    const response = await fetch(mediaUri);
    const blob = await response.blob();
    
    // Check file size
    const sizeInMB = blob.size / (1024 * 1024);
    console.log(`File size: ${sizeInMB.toFixed(2)} MB`);
    
    if (sizeInMB > 100) { // 100MB limit for Firebase
      Alert.alert('Error', 'File is too large. For videos, please select a shorter clip.');
      setUploading(false);
      return;
    }
    
    const filename = `snaps/${auth.currentUser.uid}/${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    const snapMetadata = {
      border: selectedBorder,
      background: selectedBackground,
      mediaType: mediaType
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
    Alert.alert('Success', 'Snap sent!');
    resetCamera();
  } catch (error) {
    console.error('Upload error:', error);
    Alert.alert('Error', 'Failed to send snap: ' + error.message);
  } finally {
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
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
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
      <View style={styles.editContainer}>
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
        </View>

        <View style={styles.editControls}>
          <TouchableOpacity style={styles.closeButton} onPress={resetCamera}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.nextButton}
            onPress={() => {
              setShowEditOptions(false);
              setShowFriendsList(true);
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionsContainer}>
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
      </View>
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
      <CameraView 
        style={styles.camera} 
        facing={cameraType}
        ref={cameraRef}
        onCameraReady={() => {
          setCameraReady(true);
        }}
      >
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.flipButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </CameraView>

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

      <Text style={styles.hint}>Tap center for photo • Use icons for gallery/video</Text>
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
  
  // Edit screen styles
  editContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 200, // Make room for options
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
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
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