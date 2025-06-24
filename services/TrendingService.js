import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as Location from 'expo-location';

class TrendingService {
  constructor() {
    this.userBehavior = {
      viewedSnaps: [],
      likedContent: [],
      viewDurations: {},
      searchHistory: [],
      interactionPatterns: {}
    };
  }

  // Track user behavior for real-time adaptation
  async trackUserBehavior(action, data) {
    if (!auth.currentUser) return;

    try {
      const behaviorData = {
        userId: auth.currentUser.uid,
        action: action,
        data: data,
        timestamp: new Date().toISOString()
      };

      // Store in Firestore for persistence
      await addDoc(collection(db, 'userBehavior'), behaviorData);

      // Update local cache for real-time recommendations
      switch (action) {
        case 'view_snap':
          this.userBehavior.viewedSnaps.push(data.snapId);
          this.userBehavior.viewDurations[data.snapId] = data.duration;
          break;
        case 'like_content':
          this.userBehavior.likedContent.push(data.contentId);
          break;
        case 'search':
          this.userBehavior.searchHistory.push(data.query);
          break;
        case 'interact':
          if (!this.userBehavior.interactionPatterns[data.userId]) {
            this.userBehavior.interactionPatterns[data.userId] = 0;
          }
          this.userBehavior.interactionPatterns[data.userId]++;
          break;
      }

      // Update user preferences based on behavior
      await this.updateUserPreferencesFromBehavior();
    } catch (error) {
      console.error('Error tracking behavior:', error);
    }
  }

  // Get trending snaps based on engagement
  // In TrendingService.js, update the getTrendingSnaps function:
async getTrendingSnaps() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent public stories
    const storiesQuery = query(
      collection(db, 'snaps'),
      where('type', '==', 'story'),
      where('timestamp', '>', oneDayAgo.toISOString()),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(storiesQuery);
    const stories = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Skip expired stories
      if (new Date(data.expiresAt) < now) return;
      
      // Create story with default engagement if not exists
      const engagement = {
        views: data.views || 0,
        likes: data.likes || 0,
        shares: data.shares || 0,
        avgViewDuration: 0
      };

      // Calculate trending score
      const hoursAgo = (now - new Date(data.timestamp)) / (1000 * 60 * 60);
      const trendingScore = this.calculateTrendingScore(engagement, hoursAgo);

      stories.push({
        id: doc.id,
        ...data,
        engagement,
        trendingScore
      });
    });

    // Sort by trending score
    stories.sort((a, b) => b.trendingScore - a.trendingScore);

    return stories.slice(0, 20);
  } catch (error) {
    console.error('Error getting trending snaps:', error);
    return [];
  }
}

  // Get nearby content based on location
  // In TrendingService.js, update getNearbyContent:
async getNearbyContent(radius = 10) {
  try {
    // Get all recent stories first
    const storiesQuery = query(
      collection(db, 'snaps'),
      where('type', '==', 'story'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(storiesQuery);
    const now = new Date();
    const allStories = [];
    const nearbyContent = [];

    // Get user's location if available
    let userLat, userLon;
    let hasLocation = false;
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        userLat = location.coords.latitude;
        userLon = location.coords.longitude;
        hasLocation = true;
      }
    } catch (error) {
      console.log('Location not available:', error);
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      // Skip expired stories
      if (new Date(data.expiresAt) < now) return;
      
      if (hasLocation && data.location && data.location.latitude && data.location.longitude) {
        const distance = this.calculateDistance(
          userLat, userLon,
          data.location.latitude, data.location.longitude
        );

        if (distance <= radius) {
          nearbyContent.push({
            id: doc.id,
            ...data,
            distance: distance.toFixed(1)
          });
        }
      } else {
        // If no location, add to general stories
        allStories.push({
          id: doc.id,
          ...data,
          distance: 'Unknown'
        });
      }
    });

    // If we have nearby content, return it
    if (nearbyContent.length > 0) {
      nearbyContent.sort((a, b) => a.distance - b.distance);
      return nearbyContent;
    }
    
    // Otherwise return all stories
    return allStories;
  } catch (error) {
    console.error('Error getting nearby content:', error);
    return [];
  }
}

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate trending score based on engagement
  calculateTrendingScore(engagement, hoursAgo) {
    const baseScore = (engagement.views * 1) + (engagement.likes * 3) + (engagement.shares * 5);
    const timeDecay = Math.exp(-hoursAgo / 24); // Exponential decay over 24 hours
    const durationBonus = engagement.avgViewDuration > 5 ? 1.5 : 1; // Bonus for longer views
    
    return baseScore * timeDecay * durationBonus;
  }

  // Personalize content based on user behavior
  async personalizeContent(content) {
    if (!auth.currentUser) return content;

    try {
      // Get user preferences
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      const preferences = userData.preferences || {};
      const interests = preferences.interests || [];

      // Score each content item based on user preferences
      const scoredContent = content.map(item => {
        let personalScore = item.trendingScore || 0;

        // Boost score for content from friends
        if (this.userBehavior.interactionPatterns[item.userId]) {
          personalScore *= 1.5;
        }

        // Boost score for content matching interests
        if (item.metadata?.tags) {
          const matchingInterests = item.metadata.tags.filter(tag => 
            interests.some(interest => 
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
            )
          );
          personalScore *= (1 + matchingInterests.length * 0.3);
        }

        // Boost score for similar content to what user has liked
        if (this.userBehavior.likedContent.length > 0 && item.metadata?.category) {
          // Simple category matching - could be enhanced with ML
          personalScore *= 1.2;
        }

        return { ...item, personalScore };
      });

      // Sort by personalized score
      scoredContent.sort((a, b) => b.personalScore - a.personalScore);

      return scoredContent;
    } catch (error) {
      console.error('Error personalizing content:', error);
      return content;
    }
  }

  // Update user preferences based on behavior
  async updateUserPreferencesFromBehavior() {
    if (!auth.currentUser) return;

    try {
      // Analyze behavior patterns
      const frequentInteractions = Object.entries(this.userBehavior.interactionPatterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([userId]) => userId);

      // Extract interests from search history
      const searchInterests = this.userBehavior.searchHistory
        .filter((query, index, self) => self.indexOf(query) === index) // Unique
        .slice(-10); // Last 10 unique searches

      // Update user document with derived preferences
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'derivedPreferences.frequentInteractions': frequentInteractions,
        'derivedPreferences.searchInterests': searchInterests,
        'derivedPreferences.lastUpdated': new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating preferences from behavior:', error);
    }
  }

  // Record snap engagement
  async recordEngagement(snapId, type, data = {}) {
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'snapEngagement'), {
        snapId,
        userId: auth.currentUser.uid,
        type, // 'view', 'like', 'share'
        timestamp: new Date().toISOString(),
        ...data
      });

      // Track behavior for recommendations
      await this.trackUserBehavior(`${type}_snap`, { snapId, ...data });
    } catch (error) {
      console.error('Error recording engagement:', error);
    }
  }
}

export default new TrendingService();