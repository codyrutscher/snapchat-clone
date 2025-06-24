const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

// Run this function every hour
exports.deleteExpiredStories = onSchedule({
  schedule: "every 1 hours",
  timeZone: "America/Los_Angeles", // Change to your timezone
}, async (event) => {
  console.log("Running expired stories cleanup...");

  const db = admin.firestore();
  const now = new Date();
  let batch = db.batch();
  let deleteCount = 0;

  try {
    // Query for expired stories
    const expiredStoriesSnapshot = await db
        .collection("snaps")
        .where("type", "==", "story")
        .where("expiresAt", "<=", now.toISOString())
        .get();

    console.log(`Found ${expiredStoriesSnapshot.size} expired stories`);

    // Delete expired stories in batches
    // (Firestore limit is 500 per batch)
    expiredStoriesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;

      // If we hit the batch limit, commit and start a new batch
      if (deleteCount % 500 === 0) {
        batch.commit();
        batch = db.batch();
      }
    });

    // Commit any remaining deletions
    if (deleteCount % 500 !== 0) {
      await batch.commit();
    }

    // Also delete the associated images from Storage
    if (deleteCount > 0) {
      const storage = admin.storage();

      for (const doc of expiredStoriesSnapshot.docs) {
        const storyData = doc.data();
        if (storyData.imageUrl) {
          try {
            // Extract the file path from the URL
            const urlParts = storyData.imageUrl.split("/o/");
            if (urlParts.length > 1) {
              const filePath = decodeURIComponent(
                  urlParts[1].split("?")[0],
              );
              await storage.bucket().file(filePath).delete();
              console.log(`Deleted image: ${filePath}`);
            }
          } catch (error) {
            console.error(
                `Error deleting image for story ${doc.id}:`,
                error,
            );
            // Continue even if image deletion fails
          }
        }
      }
    }

    console.log(`Successfully deleted ${deleteCount} expired stories`);
    return null;
  } catch (error) {
    console.error("Error deleting expired stories:", error);
    return null;
  }
});

// Also delete expired direct snaps (optional)
exports.deleteExpiredSnaps = onSchedule({
  schedule: "every 6 hours",
  timeZone: "America/Los_Angeles",
}, async (event) => {
  console.log("Running expired snaps cleanup...");

  const db = admin.firestore();
  const now = new Date();
  let deleteCount = 0;

  try {
    // Query for expired direct snaps that have been viewed
    const expiredSnapsSnapshot = await db
        .collection("snaps")
        .where("type", "==", "direct")
        .where("viewed", "==", true)
        .where("expiresAt", "<=", now.toISOString())
        .get();

    console.log(
        `Found ${expiredSnapsSnapshot.size} expired direct snaps`,
    );

    let batch = db.batch();

    expiredSnapsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;

      if (deleteCount % 500 === 0) {
        batch.commit();
        batch = db.batch();
      }
    });

    if (deleteCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`Successfully deleted ${deleteCount} expired snaps`);
    return null;
  } catch (error) {
    console.error("Error deleting expired snaps:", error);
    return null;
  }
});
