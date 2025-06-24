import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function PreferencesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    // Communication preferences
    preferredChatStyle: 'casual', // casual, formal, mixed
    messageFrequency: 'moderate', // low, moderate, high
    bestTimeToChat: 'evening', // morning, afternoon, evening, night
    
    // Interests
    interests: [],
    currentInterest: '',
    
    // Social preferences
    likesGroupChats: false,
    prefersVideoChats: false,
    likesVoiceMessages: false,
    
    // Personality traits
    personality: 'balanced', // introvert, extrovert, balanced
    humor: 'witty', // sarcastic, witty, wholesome, mixed
    
    // Goals
    friendshipGoals: '',
    socialGoals: '',
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().preferences) {
        setPreferences({ ...preferences, ...userDoc.data().preferences });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        preferences: preferences
      }, { merge: true });
      
      Alert.alert('Success', 'Your preferences have been saved!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const addInterest = () => {
    if (preferences.currentInterest.trim()) {
      setPreferences({
        ...preferences,
        interests: [...preferences.interests, preferences.currentInterest.trim()],
        currentInterest: ''
      });
    }
  };

  const removeInterest = (index) => {
    const newInterests = preferences.interests.filter((_, i) => i !== index);
    setPreferences({ ...preferences, interests: newInterests });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Communication Style</Text>
        
        <Text style={styles.label}>Preferred Chat Style</Text>
        <View style={styles.optionRow}>
          {['casual', 'formal', 'mixed'].map((style) => (
            <TouchableOpacity
              key={style}
              style={[
                styles.optionButton,
                preferences.preferredChatStyle === style && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, preferredChatStyle: style })}
            >
              <Text style={[
                styles.optionText,
                preferences.preferredChatStyle === style && styles.selectedText
              ]}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Message Frequency</Text>
        <View style={styles.optionRow}>
          {['low', 'moderate', 'high'].map((freq) => (
            <TouchableOpacity
              key={freq}
              style={[
                styles.optionButton,
                preferences.messageFrequency === freq && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, messageFrequency: freq })}
            >
              <Text style={[
                styles.optionText,
                preferences.messageFrequency === freq && styles.selectedText
              ]}>
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Best Time to Chat</Text>
        <View style={styles.optionRow}>
          {['morning', 'afternoon', 'evening', 'night'].map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.optionButton,
                preferences.bestTimeToChat === time && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, bestTimeToChat: time })}
            >
              <Text style={[
                styles.optionText,
                preferences.bestTimeToChat === time && styles.selectedText
              ]}>
                {time.charAt(0).toUpperCase() + time.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.interestInput}>
          <TextInput
            style={styles.input}
            placeholder="Add an interest..."
            value={preferences.currentInterest}
            onChangeText={(text) => setPreferences({ ...preferences, currentInterest: text })}
            onSubmitEditing={addInterest}
          />
          <TouchableOpacity style={styles.addButton} onPress={addInterest}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.interestsList}>
          {preferences.interests.map((interest, index) => (
            <View key={index} style={styles.interestChip}>
              <Text style={styles.interestText}>{interest}</Text>
              <TouchableOpacity onPress={() => removeInterest(index)}>
                <Ionicons name="close-circle" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Preferences</Text>
        
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>I enjoy group chats</Text>
          <Switch
            value={preferences.likesGroupChats}
            onValueChange={(value) => setPreferences({ ...preferences, likesGroupChats: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>I prefer video chats</Text>
          <Switch
            value={preferences.prefersVideoChats}
            onValueChange={(value) => setPreferences({ ...preferences, prefersVideoChats: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>I like voice messages</Text>
          <Switch
            value={preferences.likesVoiceMessages}
            onValueChange={(value) => setPreferences({ ...preferences, likesVoiceMessages: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personality</Text>
        
        <Text style={styles.label}>Social Style</Text>
        <View style={styles.optionRow}>
          {['introvert', 'extrovert', 'balanced'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionButton,
                preferences.personality === type && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, personality: type })}
            >
              <Text style={[
                styles.optionText,
                preferences.personality === type && styles.selectedText
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Humor Style</Text>
        <View style={styles.optionRow}>
          {['sarcastic', 'witty', 'wholesome', 'mixed'].map((humor) => (
            <TouchableOpacity
              key={humor}
              style={[
                styles.optionButton,
                preferences.humor === humor && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, humor: humor })}
            >
              <Text style={[
                styles.optionText,
                preferences.humor === humor && styles.selectedText
              ]}>
                {humor.charAt(0).toUpperCase() + humor.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friendship Goals</Text>
        <TextInput
          style={styles.textArea}
          placeholder="What do you hope to achieve in your friendships?"
          value={preferences.friendshipGoals}
          onChangeText={(text) => setPreferences({ ...preferences, friendshipGoals: text })}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
        onPress={savePreferences}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    marginTop: 10,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  optionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray,
    backgroundColor: 'white',
  },
  selectedOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    color: Colors.gray,
    fontSize: 14,
  },
  selectedText: {
    color: 'white',
    fontWeight: 'bold',
  },
  interestInput: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    margin: 5,
  },
  interestText: {
    color: Colors.primary,
    marginRight: 5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.black,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    margin: 20,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});