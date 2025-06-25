import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Alert, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Platform,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';

const { width } = Dimensions.get('window');

const developerStories = [
  {
    icon: 'code-slash',
    title: 'Code Together, Ship Faster',
    description: 'Share code snippets, debug together, and collaborate on projects with fellow developers.',
    color: '#00D9FF'
  },
  {
    icon: 'git-branch',
    title: 'AI-Powered Code Reviews',
    description: 'Get instant feedback on your code with AI suggestions for optimization and best practices.',
    color: '#F7B731'
  },
  {
    icon: 'terminal',
    title: 'Developer Communities',
    description: 'Connect with developers who share your tech stack. Find mentors, collaborators, and friends.',
    color: '#5F27CD'
  },
  {
    icon: 'rocket',
    title: 'Launch & Learn Together',
    description: 'Share your project launches, get feedback, and celebrate wins with the dev community.',
    color: '#00D9FF'
  },
  {
    icon: 'bug',
    title: 'Debug Life\'s Problems',
    description: 'Not just code - share your developer journey, struggles, and victories with peers who understand.',
    color: '#EE5A24'
  },
  {
    icon: 'shield-checkmark',
    title: 'Safe Dev Space',
    description: 'AI-moderated environment keeps discussions professional. Share code without fear of theft.',
    color: '#2ECC71'
  }
];

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentIndex < developerStories.length - 1) {
        scrollViewRef.current?.scrollTo({
          x: (currentIndex + 1) * width,
          animated: true
        });
        setCurrentIndex(currentIndex + 1);
      } else {
        scrollViewRef.current?.scrollTo({
          x: 0,
          animated: true
        });
        setCurrentIndex(0);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="code-slash" size={40} color="white" />
            <Text style={styles.title}>DevChat</Text>
          </View>
          <Text style={styles.subtitle}>Where Developers Connect & Code</Text>
        </View>

        <View style={styles.storiesContainer}>
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
          >
            {developerStories.map((story, index) => (
              <View key={index} style={styles.storyCard}>
                <View style={[styles.iconContainer, { backgroundColor: story.color + '20' }]}>
                  <Ionicons name={story.icon} size={40} color={story.color} />
                </View>
                <Text style={styles.storyTitle}>{story.title}</Text>
                <Text style={styles.storyDescription}>{story.description}</Text>
              </View>
            ))}
          </Animated.ScrollView>
          
          <View style={styles.pagination}>
            {developerStories.map((_, index) => {
              const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 20, 8],
                extrapolate: 'clamp',
              });
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={index}
                  style={[styles.dot, { width: dotWidth, opacity }]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="dev@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#999"
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Authenticating...' : 'Deploy to DevChat'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>New to DevChat? Start your free trial</Text>
          </TouchableOpacity>

          <View style={styles.techStack}>
            <Text style={styles.techStackTitle}>Built with:</Text>
            <View style={styles.techIcons}>
              <Text style={styles.techIcon}>⚛️ React Native</Text>
              <Text style={styles.techIcon}>🔥 Firebase</Text>
              <Text style={styles.techIcon}>🤖 OpenAI</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  storiesContainer: {
    height: 200,
    marginVertical: 20,
  },
  storyCard: {
    width: width,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  storyDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginHorizontal: 4,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#0f0f1e',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 40,
    paddingHorizontal: 30,
    paddingBottom: 40,
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  button: {
    backgroundColor: '#00D9FF',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(0, 217, 255, 0.5)',
  },
  buttonText: {
    color: '#0f0f1e',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  link: {
    textAlign: 'center',
    marginTop: 20,
    color: '#00D9FF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  techStack: {
    marginTop: 40,
    alignItems: 'center',
  },
  techStackTitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  techIcons: {
    flexDirection: 'row',
    gap: 15,
  },
  techIcon: {
    color: '#999',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});