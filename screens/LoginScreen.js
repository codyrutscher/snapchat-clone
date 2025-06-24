import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <View style={styles.container}>
      <Text style={styles.title}>FlashChat</Text>
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
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Log In'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
      backgroundColor: '#6B5CFF', // Changed from yellow
    },
    title: {
      fontSize: 48,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 50,
      color: 'white', // Changed from black
    },
    input: {
      backgroundColor: 'white',
      padding: 15,
      borderRadius: 25,
      marginBottom: 15,
      fontSize: 16,
    },
    button: {
      backgroundColor: 'white', // Changed from black
      padding: 15,
      borderRadius: 25,
      marginTop: 10,
    },
    buttonDisabled: {
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    buttonText: {
      color: '#6B5CFF', // Changed from white
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: 16,
    },
    link: {
      textAlign: 'center',
      marginTop: 20,
      color: 'white', // Changed from black
      fontSize: 16,
    },
  });