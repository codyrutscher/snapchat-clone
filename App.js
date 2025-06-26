import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Constants from 'expo-constants';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from './constants/Colors';
import { auth } from './firebase';
import CodeEditorScreen from './screens/CodeEditorScreen';
import CreateGroupScreen from './screens/CreateGroupScreen';
import PreferencesScreen from './screens/PreferencesScreen';

// Import screens
import AddFriendsScreen from './screens/AddFriendsScreen';
import CameraScreen from './screens/CameraScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';
import LoginScreen from './screens/LoginScreen';
import MyStoriesScreen from './screens/MyStoriesScreen';
import ProfileScreen from './screens/ProfileScreen';
import RegisterScreen from './screens/RegisterScreen';
import SnapsScreen from './screens/SnapsScreen';
import StoriesScreen from './screens/StoriesScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import BlockedUsersScreen from './screens/BlockedUsersScreen';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong!</Text>
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorText}>{this.state.error && this.state.error.toString()}</Text>
            <Text style={styles.errorStack}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.lightGray,
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Snaps" 
        component={SnapsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />

         <Tab.Screen 
        name="Code" 
        component={CodeEditorScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="code-slash-outline" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen 
  name="Discover" 
  component={DiscoverScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="compass-outline" size={size} color={color} />
    ),
  }}
/>
      <Tab.Screen 
        name="Stories" 
        component={StoriesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  const isInitialized = useRef(false);

  // Log app start only once
  useEffect(() => {
    if (!isInitialized.current) {
      console.log('=== APP STARTING ===');
      console.log('Platform:', Platform.OS);
      console.log('Expo SDK:', Constants.expoConfig?.sdkVersion);
      isInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    console.log('Setting up auth listener...');
    
    let unsubscribe;
    try {
      setTimeout(() => {
        if (!auth) {
          setInitError('Firebase auth is not initialized');
          setLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, 
          (user) => {
            console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
            setUser(user);
            setLoading(false);
          },
          (error) => {
            console.error('Auth listener error:', error);
            setInitError(error.message);
            setLoading(false);
          }
        );
      }, 100);
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('Setup error:', error);
      setInitError(error.message);
      setLoading(false);
    }
  }, []);

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorText}>{initError}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading FlashChat...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen} 
              options={{ 
                headerShown: true, 
                title: 'Sign Up',
                headerStyle: {
                  backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.white,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen 
              name="ChatDetail" 
              component={ChatScreen} 
              options={{ 
                headerShown: true, 
                title: 'Chat',
                headerStyle: {
                  backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.white,
              }}
            />

            <Stack.Screen 
  name="BlockedUsers" 
  component={BlockedUsersScreen} 
  options={{ 
    headerShown: false,
  }}
/>
            <Stack.Screen 
              name="AddFriends" 
              component={AddFriendsScreen} 
              options={{ 
                headerShown: true, 
                title: 'Add Friends',
                headerStyle: {
                  backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.white,
              }}
            />

            <Stack.Screen 
  name="CreateGroup" 
  component={CreateGroupScreen} 
  options={{ 
    headerShown: false,
  }}
/>

            <Stack.Screen 
              name="MyStories" 
              component={MyStoriesScreen} 
              options={{ 
                headerShown: true, 
                title: 'My Stories',
                headerStyle: {
                  backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.white,
              }}
            />

            <Stack.Screen 
  name="Preferences" 
  component={PreferencesScreen} 
  options={{ 
    headerShown: true, 
    title: 'My Preferences',
    headerStyle: {
      backgroundColor: Colors.primary,
    },
    headerTintColor: Colors.white,
  }}
/>

<Stack.Screen 
  name="CodeEditor" 
  component={CodeEditorScreen}
  options={{ 
    headerShown: false,
  }}
/>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff0000',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
  errorScroll: {
    maxHeight: 300,
    marginTop: 10,
  },
  errorStack: {
    fontSize: 12,
    color: '#ffcccc',
    marginTop: 10,
  },
});