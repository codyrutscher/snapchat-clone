import { collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

class AppDeployService {
  async deployApp(project) {
    console.log('=== Starting App Deployment ===');
    try {
      // Generate production HTML
      console.log('Generating production HTML...');
      const previewHtml = this.generateProductionHtml(project);
      console.log('HTML generated, length:', previewHtml.length);
      
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `apps/${project.id}_${timestamp}.html`;
      console.log('Filename:', fileName);
      
      // Create storage reference
      const storageRef = ref(storage, fileName);
      
      try {
        console.log('Uploading to Firebase Storage...');
        // Upload as raw string - this should work without blob issues
        await uploadString(storageRef, previewHtml, 'raw');
        console.log('Upload successful!');
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        // If raw fails, try a different approach
        try {
          console.log('Trying data_url format...');
          const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`;
          await uploadString(storageRef, dataUrl, 'data_url');
          console.log('Data URL upload successful!');
        } catch (secondError) {
          console.error('Second upload attempt failed:', secondError);
          throw uploadError;
        }
      }
      
      // Get download URL
      console.log('Getting download URL...');
      const deployUrl = await getDownloadURL(storageRef);
      console.log('Deploy URL:', deployUrl);
      
      // Save app metadata to Firestore (without file data to avoid size issues)
      const appData = {
        projectId: project.id,
        name: project.name,
        description: project.description || 'A React app built with DevChat Code',
        owner: auth.currentUser?.uid || 'anonymous',
        ownerName: auth.currentUser?.displayName || 'Developer',
        deployUrl: deployUrl,
        fileName: fileName,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        fileCount: Object.keys(project.files).length,
        public: true
      };
      
      console.log('Saving to Firestore...');
      // Save to Firestore
      const appRef = await addDoc(collection(db, 'deployedApps'), appData);
      console.log('Saved to Firestore with ID:', appRef.id);
      
      return {
        id: appRef.id,
        url: deployUrl
      };
    } catch (error) {
      console.error('Error in deployApp:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Return a local preview URL as fallback
      console.log('Falling back to local preview');
      const localPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(this.generateProductionHtml(project))}`;
      return {
        id: 'local_' + Date.now(),
        url: localPreviewUrl,
        isLocal: true
      };
    }
  }

  generateProductionHtml(project) {
    // Get all JavaScript content
    let jsContent = '';
    
    // Process components and utilities first
    Object.entries(project.files).forEach(([filePath, file]) => {
      if (filePath.endsWith('.js') && filePath !== 'src/App.js') {
        const content = file.content || '';
        // Remove imports and exports
        const cleanContent = content
          .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
          .replace(/export\s+(default\s+)?/g, '');
        
        jsContent += `\n// ${filePath}\n${cleanContent}\n`;
      }
    });
    
    // Add App.js last
    const appContent = project.files['src/App.js']?.content || 'function App() { return React.createElement("div", null, "Hello World"); }';
    const cleanAppContent = appContent
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      .replace(/export\s+(default\s+)?/g, '');
    
    jsContent += `\n// src/App.js\n${cleanAppContent}\n`;
    
    // Get all CSS
    let cssContent = '';
    Object.entries(project.files).forEach(([filePath, file]) => {
      if (filePath.endsWith('.css')) {
        cssContent += `\n/* ${filePath} */\n${file.content || ''}\n`;
      }
    });
    
    // Generate simple HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name}</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        #root {
            min-height: 100vh;
        }
        ${cssContent}
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        ${jsContent}
        
        // Render the app
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
    </script>
</body>
</html>`;
    
    return html;
  }

  async shareAsStory(project, description) {
    try {
      const storyData = {
        userId: auth.currentUser?.uid || 'anonymous',
        username: auth.currentUser?.displayName || 'Developer',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'story',
        contentType: 'app',
        appData: {
          projectId: project.id,
          name: project.name,
          description: description,
          linesOfCode: this.countLinesOfCode(project.files)
        },
        public: true
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
      if (!appDoc.exists()) {
        throw new Error('App not found');
      }
      
      // Return a placeholder for now
      return {
        id: 'forked_' + Date.now(),
        name: appDoc.data().name + ' (Fork)'
      };
    } catch (error) {
      console.error('Error forking app:', error);
      throw error;
    }
  }
}

export default new AppDeployService();