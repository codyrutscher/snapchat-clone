import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

class SubscriptionService {
  constructor() {
    this.subscriptionStatus = null;
    this.snapCount = 0;
    this.storyCount = 0;
    this.snippetCount = 0;
    this.monthlyLimit = 20;
    this.listeners = [];
  }

  // Initialize subscription tracking
  async initializeSubscription() {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          this.subscriptionStatus = data.subscription || null;
          this.snapCount = data.monthlySnapCount || 0;
          this.storyCount = data.monthlyStoryCount || 0;
          this.snippetCount = data.monthlySnippetCount || 0;
          
          // Reset counts if new month
          const lastReset = data.lastCountReset ? new Date(data.lastCountReset) : null;
          const now = new Date();
          
          if (!lastReset || 
              lastReset.getMonth() !== now.getMonth() || 
              lastReset.getFullYear() !== now.getFullYear()) {
            this.resetMonthlyCounts();
          }
          
          // Notify listeners
          this.notifyListeners();
        }
      });


        this.notifyListeners();
        
      return unsubscribe;
    } catch (error) {
      console.error('Error initializing subscription:', error);
    }
  }

  // Check if user can send snap/story/snippet
  async canSendContent(type = 'snap') {
    if (!auth.currentUser) return false;

    // If subscribed, always return true
    if (this.isSubscribed()) return true;

    // Check monthly limits
    let count;
    switch(type) {
      case 'snap':
        count = this.snapCount;
        break;
      case 'story':
        count = this.storyCount;
        break;
      case 'snippet':
        count = this.snippetCount;
        break;
      default:
        count = 0;
    }
    return count < this.monthlyLimit;
  }


  // Add this method to your SubscriptionService class:
async checkSubscriptionStatus() {
  if (!auth.currentUser) return;
  
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      this.subscriptionStatus = data.subscription || null;
      this.snapCount = data.monthlySnapCount || 0;
      this.storyCount = data.monthlyStoryCount || 0;
      this.snippetCount = data.monthlySnippetCount || 0;
      
      // Notify listeners with updated data
      this.notifyListeners();
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
  }
}

  // Increment content count
  async incrementContentCount(type = 'snap') {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      let field, currentCount;
      
      switch(type) {
        case 'snap':
          field = 'monthlySnapCount';
          currentCount = this.snapCount;
          break;
        case 'story':
          field = 'monthlyStoryCount';
          currentCount = this.storyCount;
          break;
        case 'snippet':
          field = 'monthlySnippetCount';
          currentCount = this.snippetCount;
          break;
        default:
          return;
      }
      
      await updateDoc(userRef, {
        [field]: currentCount + 1,
        lastCountReset: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error incrementing count:', error);
    }
  }

  // Reset monthly counts
  async resetMonthlyCounts() {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        monthlySnapCount: 0,
        monthlyStoryCount: 0,
        monthlySnippetCount: 0,
        lastCountReset: new Date().toISOString()
      });
      
      this.snapCount = 0;
      this.storyCount = 0;
      this.snippetCount = 0;
    } catch (error) {
      console.error('Error resetting counts:', error);
    }
  }

  // Update subscription status
  async updateSubscriptionStatus(subscriptionId, status = 'active') {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        subscription: {
          id: subscriptionId,
          status: status,
          startDate: new Date().toISOString(),
          type: 'pro',
          amount: 5.00
        }
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  }

  // Cancel subscription
  async cancelSubscription() {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        'subscription.status': 'cancelled',
        'subscription.cancelledAt': new Date().toISOString()
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    }
  }

  // Check if user is subscribed
  isSubscribed() {
    return this.subscriptionStatus?.status === 'active';
  }

  // Get remaining content count
  getRemainingContent() {
    if (this.isSubscribed()) return 'Unlimited';
    
    return {
      snaps: Math.max(0, this.monthlyLimit - this.snapCount),
      stories: Math.max(0, this.monthlyLimit - this.storyCount),
      codeSnippets: Math.max(0, this.monthlyLimit - this.snippetCount)
    };
  }

  // Add listener for subscription changes
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => callback({
      isSubscribed: this.isSubscribed(),
      remaining: this.getRemainingContent(),
      snapCount: this.snapCount,
      storyCount: this.storyCount,
      snippetCount: this.snippetCount
    }));
  }
}

export default new SubscriptionService();