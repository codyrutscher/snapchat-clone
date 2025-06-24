import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where, addDoc, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import SnapRenderer from '../components/SnapRenderer';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';
import { SmartReplyBar } from '../components/AIAssistant';
import OpenAIService from '../services/OpenAIService';

export default function SnapsScreen() {
  const [receivedSnaps, setReceivedSnaps] = useState([]);
  const [viewedSnaps, setViewedSnaps] = useState([]);
  const [viewingSnap, setViewingSnap] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewTimer, setViewTimer] = useState(null);
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [currentSnapForReply, setCurrentSnapForReply] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    loadSnaps();
    
    // Cleanup timer on unmount
    return () => {
      if (viewTimer) {
        clearTimeout(viewTimer);
      }
    };
  }, []);

  const loadSnaps = () => {
    console.log('Loading snaps for user:', auth.currentUser.uid);

    // Query for unviewed snaps
    const unviewedQuery = query(
      collection(db, 'snaps'),
      where('recipientId', '==', auth.currentUser.uid),
      where('type', '==', 'direct'),
      where('viewed', '==', false)
    );

    // Query for viewed snaps (last 24 hours)
    const viewedQuery = query(
      collection(db, 'snaps'),
      where('recipientId', '==', auth.currentUser.uid),
      where('type', '==', 'direct'),
      where('viewed', '==', true)
    );

    // Listen to unviewed snaps
    const unviewedUnsubscribe = onSnapshot(unviewedQuery, (snapshot) => {
      const snaps = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if snap hasn't expired
        if (new Date(data.expiresAt) > new Date()) {
          snaps.push({ id: doc.id, ...data });
        }
      });
      console.log('Unviewed snaps found:', snaps.length);
      setReceivedSnaps(snaps);
    }, (error) => {
      console.error('Error loading unviewed snaps:', error);
    });

    // Listen to viewed snaps
    const viewedUnsubscribe = onSnapshot(viewedQuery, (snapshot) => {
      const snaps = [];
      const now = new Date();
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only show viewed snaps from last 24 hours
        const viewedAt = new Date(data.viewedAt);
        const hoursSinceViewed = (now - viewedAt) / (1000 * 60 * 60);
        
        if (hoursSinceViewed < 24 && new Date(data.expiresAt) > now) {
          snaps.push({ id: doc.id, ...data });
        }
      });
      console.log('Viewed snaps found:', snaps.length);
      setViewedSnaps(snaps);
    });

    return () => {
      unviewedUnsubscribe();
      viewedUnsubscribe();
    };
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadSnaps();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const viewSnap = async (snap) => {
    console.log('Viewing snap:', snap.id);
    setViewingSnap(snap);
    setCurrentSnapForReply(snap);
    setShowSmartReplies(true);
    
    // Mark as viewed
    try {
      await updateDoc(doc(db, 'snaps', snap.id), {
        viewed: true,
        viewedAt: new Date().toISOString()
      });
      console.log('Snap marked as viewed');
    } catch (error) {
      console.error('Error marking snap as viewed:', error);
    }

    // Auto-close and delete after 15 seconds
    const timer = setTimeout(() => {
      setViewingSnap(null);
      setShowSmartReplies(false);
      // Delete the snap after viewing
      deleteSnap(snap.id);
    }, 15000);
    
    setViewTimer(timer);
  };

  const closeSnap = () => {
    if (viewTimer) {
      clearTimeout(viewTimer);
    }
    setViewingSnap(null);
    setShowSmartReplies(false);
  };

  const deleteSnap = async (snapId) => {
    try {
      await deleteDoc(doc(db, 'snaps', snapId));
      console.log('Snap deleted');
    } catch (error) {
      console.error('Error deleting snap:', error);
    }
  };

  const sendQuickReply = async (toUserId, message) => {
    try {
      // Find or create chat with this user
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(chatsQuery);
      let chatId = null;
      
      snapshot.forEach((doc) => {
        const chat = doc.data();
        if (chat.participants.includes(toUserId)) {
          chatId = doc.id;
        }
      });
      
      if (chatId) {
        // Add message to existing chat
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: message,
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'You',
          timestamp: new Date().toISOString(),
          isQuickReply: true
        });
        
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: message,
          lastMessageTime: new Date().toISOString()
        });
        
        Alert.alert('Sent!', `Reply sent to ${viewingSnap.username}`);
        setShowSmartReplies(false);
      } else {
        Alert.alert('Info', 'Start a chat first to send replies');
      }
    } catch (error) {
      console.error('Error sending quick reply:', error);
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  const renderSnap = ({ item }) => (
    <TouchableOpacity style={styles.snapItem} onPress={() => viewSnap(item)}>
      <View style={styles.snapIcon}>
        <Ionicons name="mail-unread" size={30} color={Colors.primary} />
      </View>
      <View style={styles.snapInfo}>
        <Text style={styles.snapSender}>{item.username || 'Unknown'}</Text>
        <Text style={styles.snapTime}>Tap to view • {getTimeAgo(item.timestamp)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
    </TouchableOpacity>
  );

  const renderViewedSnap = ({ item }) => (
    <View style={[styles.snapItem, styles.viewedSnapItem]}>
      <View style={styles.snapIcon}>
        <Ionicons name="mail-open-outline" size={30} color={Colors.gray} />
      </View>
      <View style={styles.snapInfo}>
        <Text style={[styles.snapSender, styles.viewedText]}>{item.username || 'Unknown'}</Text>
        <Text style={[styles.snapTime, styles.viewedText]}>
          Viewed {getTimeAgo(item.viewedAt)} • Expires {getTimeAgo(item.expiresAt)}
        </Text>
      </View>
    </View>
  );

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / 60000);
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[...receivedSnaps, ...viewedSnaps]}
        renderItem={({ item }) => item.viewed ? renderViewedSnap({ item }) : renderSnap({ item })}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={styles.title}>Snaps</Text>
            {receivedSnaps.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{receivedSnaps.length} new</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-open-outline" size={80} color={Colors.gray} />
            <Text style={styles.emptyText}>No snaps</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal
        visible={viewingSnap !== null}
        animationType="fade"
        onRequestClose={closeSnap}
      >
        {viewingSnap && (
          <TouchableOpacity 
            style={styles.snapModal} 
            activeOpacity={1}
            onPress={closeSnap}
          >
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
              imageData={viewingSnap.imageData}
              metadata={viewingSnap.metadata}
              containerStyle={styles.snapImageContainer}
              imageStyle={styles.snapImage}
            />

            {/* Smart Reply Bar */}
            {showSmartReplies && (
              <View style={styles.smartReplyContainer}>
                <SmartReplyBar
                  snapContext={{
                    senderName: viewingSnap.username,
                    hasText: viewingSnap.metadata?.text ? true : false,
                    filter: viewingSnap.metadata?.filter
                  }}
                  onSelectReply={async (reply) => {
                    await sendQuickReply(viewingSnap.userId, reply);
                  }}
                />
              </View>
            )}
            
            <View style={styles.snapFooter}>
              <Text style={styles.timerText}>Closes in 15s • Tap to close</Text>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.black,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  snapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.white,
  },
  viewedSnapItem: {
    opacity: 0.6,
  },
  snapIcon: {
    marginRight: 15,
  },
  snapInfo: {
    flex: 1,
  },
  snapSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.black,
  },
  snapTime: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 2,
  },
  viewedText: {
    color: Colors.gray,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginLeft: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.gray,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 5,
  },
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
  snapImageContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  snapImage: {
    resizeMode: 'contain',
  },
  smartReplyContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
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
});