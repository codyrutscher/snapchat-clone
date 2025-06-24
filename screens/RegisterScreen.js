import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Validate username
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, {
        displayName: trimmedUsername
      });

      // Store user data with lowercase username for easier searching
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: trimmedUsername,
        displayName: username.trim(), // Store original case for display
        email: email.toLowerCase(),
        createdAt: new Date().toISOString(),
        userId: userCredential.user.uid,
        friends: [],
        searchableUsername: trimmedUsername // For searching
      });

      console.log('User created successfully:', trimmedUsername);

    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 50,
    color: 'white',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 25,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 25,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  buttonText: {
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});