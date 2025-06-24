import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from './firebase';

// Function to clean up expired stories and snaps
export const cleanupExpiredContent = async () => {
  console.log('Running cleanup service...');
  
  try {
    const now = new Date();
    
    // Query for expired content
    const q = query(
      collection(db, 'snaps'),
      where('expiresAt', '<=', now.toISOString())
    );
    
    const snapshot = await getDocs(q);
    let deletedCount = 0;
    
    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        
        // Delete from Firestore
        await deleteDoc(doc(db, 'snaps', docSnap.id));
        
        // Delete image from Storage
        if (data.imageUrl) {
          try {
            const urlParts = data.imageUrl.split('/o/');
            if (urlParts.length > 1) {
              const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
              const imageRef = ref(storage, filePath);
              await deleteObject(imageRef);
            }
          } catch (storageError) {
            console.log('Storage deletion error:', storageError);
            // Continue even if storage deletion fails
          }
        }
        
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting snap ${docSnap.id}:`, error);
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} expired items.`);
    return deletedCount;
  } catch (error) {
    console.error('Cleanup service error:', error);
    return 0;
  }
};

// Function to schedule periodic cleanup
export const startCleanupSchedule = () => {
  // Run cleanup immediately
  cleanupExpiredContent();
  
  // Run cleanup every hour
  const interval = setInterval(() => {
    cleanupExpiredContent();
  }, 60 * 60 * 1000); // 1 hour
  
  return interval;
};