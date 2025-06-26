import React from 'react';
import { Video } from 'expo-av';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

// Import the same filter, border, and background definitions
const FILTERS = [
  { id: 'none', name: 'None', style: {} },
  { id: 'grayscale', name: 'B&W', style: Platform.OS === 'web' ? { filter: 'grayscale(1)' } : {} },
  { id: 'sepia', name: 'Sepia', style: Platform.OS === 'web' ? { filter: 'sepia(1)' } : {} },
  { id: 'bright', name: 'Bright', style: Platform.OS === 'web' ? { filter: 'brightness(1.3)' } : {} },
  { id: 'dark', name: 'Dark', style: Platform.OS === 'web' ? { filter: 'brightness(0.7)' } : {} },
  { id: 'contrast', name: 'Pop', style: Platform.OS === 'web' ? { filter: 'contrast(1.3)' } : {} },
  { id: 'saturate', name: 'Vivid', style: Platform.OS === 'web' ? { filter: 'saturate(1.5)' } : {} },
];

const BORDERS = [
  { id: 'none', name: 'None', style: {} },
  { id: 'white', name: 'White', style: { borderWidth: 20, borderColor: 'white' } },
  { id: 'black', name: 'Black', style: { borderWidth: 20, borderColor: 'black' } },
  { id: 'rounded', name: 'Rounded', style: { borderRadius: 30, overflow: 'hidden' } },
];

const BACKGROUNDS = [
  { id: 'none', name: 'None', color: 'transparent' },
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'black', name: 'Black', color: '#000000' },
  { id: 'purple', name: 'Purple', color: '#6B5CFF' },
  { id: 'pink', name: 'Pink', color: '#FF6B6B' },
  { id: 'blue', name: 'Blue', color: '#4ECDC4' },
];

export default function SnapRenderer({ imageUrl, metadata, style, imageStyle, containerStyle }) {
  const getFilterStyle = () => {
    if (!metadata?.filter) return {};
    const filter = FILTERS.find(f => f.id === metadata.filter);
    return filter ? filter.style : {};
  };

  const getBorderStyle = () => {
    if (!metadata?.border) return {};
    const border = BORDERS.find(b => b.id === metadata.border);
    return border ? border.style : {};
  };

  const getBackgroundStyle = () => {
    if (!metadata?.background) return { backgroundColor: 'transparent' };
    const bg = BACKGROUNDS.find(b => b.id === metadata.background);
    if (!bg || bg.id === 'none') return { backgroundColor: 'transparent' };
    
    if (bg.colors) {
      return { backgroundColor: bg.colors[0] };
    }
    return { backgroundColor: bg.color || 'transparent' };
  };

  const currentBackground = metadata?.background ? BACKGROUNDS.find(b => b.id === metadata.background) : null;

  return (
    <View style={[styles.container, getBackgroundStyle(), containerStyle]}>
      {currentBackground?.emoji && (
        <View style={styles.backgroundPatternContainer}>
          {Array(30).fill(0).map((_, i) => (
            <Text key={i} style={styles.backgroundPattern}>
              {currentBackground.emoji}
            </Text>
          ))}
        </View>
      )}
     <View style={[styles.imageWrapper, getBorderStyle(), style]}>
       {metadata?.mediaType === 'video' ? (
  <Video
    source={{ uri: imageUrl }}
    style={[styles.image, getFilterStyle(), imageStyle]}
    shouldPlay={false}  // Changed from true to false
    isLooping={false}   // Changed from true to false
    resizeMode="contain"
    isMuted={true}      // Changed to true by default
    volume={0.5}
  />
) : (
          <Image 
            source={{ uri: imageUrl }} 
            style={[styles.image, getFilterStyle(), imageStyle]}
            resizeMode="contain"
          />
        )}
      </View>
      
      {/* Text overlay */}
      {metadata?.text && (
        <View style={[styles.textOverlay, metadata.textPosition && { 
          top: metadata.textPosition.y - 50,
          left: 20,
          right: 20
        }]}>
          <Text style={styles.snapText}>{metadata.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textOverlay: {
    position: 'absolute',
    alignItems: 'center',
  },
  snapText: {
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
});