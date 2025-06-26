import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

class AppDeployService {
  async deployApp(project) {
    try {
      // Generate preview HTML
      const previewHtml = this.generateProductionHtml(project);
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, `apps/${project.id}/index.html`);
      await uploadString(storageRef, previewHtml, 'raw');
      const deployUrl = await getDownloadURL(storageRef);
      
      // Save app metadata to Firestore
      const appData = {
        projectId: project.id,
        name: project.name,
        description: project.description || 'A React app built with DevChat Code',
        owner: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || 'Developer',
        deployUrl: deployUrl,
        files: project.files,
        dependencies: project.dependencies,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        downloads: 0,
        likes: 0,
        forks: 0,
        public: true
      };
      
      const appRef = await addDoc(collection(db, 'deployedApps'), appData);
      
      return {
        id: appRef.id,
        url: deployUrl
      };
    } catch (error) {
      console.error('Error deploying app:', error);
      throw error;
    }
  }

  generateProductionHtml(project) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${project.files['src/App.css']?.content || ''}
    ${project.files['src/index.css']?.content || ''}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${project.files['src/App.js']?.content || ''}
    ${Object.entries(project.files)
      .filter(([path]) => path.includes('components/'))
      .map(([_, file]) => file.content)
      .join('\n')}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
    
    return html;
  }

  async shareAsStory(project, description) {
    try {
      const storyData = {
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Developer',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'story',
        contentType: 'app',
        appData: {
          projectId: project.id,
          name: project.name,
          description: description,
          previewImage: null, // Could generate a screenshot
          linesOfCode: this.countLinesOfCode(project.files)
        },
        public: true,
        views: 0,
        likes: 0,
        shares: 0
      };
      
      await addDoc(collection(db, 'snaps'), storyData);
      return true;
    } catch (error) {
      console.error('Error sharing as story:', error);
      throw error;
    }
  }

  countLinesOfCode(files) {
    let total = 0;
    Object.values(files).forEach(file => {
      if (file.content) {
        total += file.content.split('\n').length;
      }
    });
    return total;
  }

  async forkApp(appId) {
    try {
      const appDoc = await getDoc(doc(db, 'deployedApps', appId));
      const appData = appDoc.data();
      
      // Create new project from forked app
      const project = await VirtualFileSystem.createProject(`${appData.name} (Fork)`);
      
      // Copy all files
      for (const [filePath, fileData] of Object.entries(appData.files)) {
        await VirtualFileSystem.saveFile(project.id, filePath, fileData.content);
      }
      
      // Update fork count
      await updateDoc(doc(db, 'deployedApps', appId), {
        forks: (appData.forks || 0) + 1
      });
      
      return project;
    } catch (error) {
      console.error('Error forking app:', error);
      throw error;
    }
  }
}

export default new AppDeployService();