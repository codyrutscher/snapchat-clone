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
  ActivityIndicator,
  Platform
} from 'react-native';
import { Colors } from '../constants/Colors';
import { auth, db } from '../firebase';

export default function PreferencesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    // Developer communication preferences
    codeReviewStyle: 'thorough', // thorough, quick, balanced
    debuggingApproach: 'systematic', // systematic, intuitive, collaborative
    documentationLevel: 'detailed', // minimal, moderate, detailed
    
    // Tech stack
    primaryLanguages: [],
    currentLanguage: '',
    frameworks: [],
    currentFramework: '',
    databases: [],
    currentDatabase: '',
    
    // Collaboration preferences
    pairProgramming: true,
    codeReviews: true,
    openSource: true,
    mentoring: false,
    
    // Work style
    workSchedule: 'night-owl', // early-bird, nine-to-five, night-owl, flexible
    timezone: 'PST',
    remoteWork: true,
    
    // Learning interests
    learningGoals: [],
    currentLearningGoal: '',
    experienceLevel: 'senior', // junior, mid, senior, principal
    
    // Project preferences
    projectTypes: 'fullstack', // frontend, backend, fullstack, mobile, devops
    teamSize: 'small', // solo, small, medium, large
    
    // Communication
    preferredIDE: 'vscode',
    gitWorkflow: 'feature-branch',
    favoriteDevJoke: '',
    
    // Developer personality
    debuggingStyle: 'rubber-duck',
    caffeineDependency: 'high',
    tabsVsSpaces: 'spaces',
    darkMode: true,
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
      
      Alert.alert('Success', 'Your developer preferences have been saved!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field, currentField) => {
    const currentValue = preferences[currentField];
    if (currentValue.trim()) {
      setPreferences({
        ...preferences,
        [field]: [...preferences[field], currentValue.trim()],
        [currentField]: ''
      });
    }
  };

  const removeItem = (field, index) => {
    const newItems = preferences[field].filter((_, i) => i !== index);
    setPreferences({ ...preferences, [field]: newItems });
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
        <Text style={styles.sectionTitle}>💻 Tech Stack</Text>
        
        <Text style={styles.label}>Programming Languages</Text>
        <View style={styles.itemInput}>
          <TextInput
            style={styles.input}
            placeholder="Add language (e.g., JavaScript, Python)"
            placeholderTextColor={Colors.gray}
            value={preferences.currentLanguage}
            onChangeText={(text) => setPreferences({ ...preferences, currentLanguage: text })}
            onSubmitEditing={() => addItem('primaryLanguages', 'currentLanguage')}
          />
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => addItem('primaryLanguages', 'currentLanguage')}
          >
            <Ionicons name="add" size={24} color={Colors.background} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.itemsList}>
          {preferences.primaryLanguages.map((lang, index) => (
            <View key={index} style={styles.itemChip}>
              <Text style={styles.itemText}>{lang}</Text>
              <TouchableOpacity onPress={() => removeItem('primaryLanguages', index)}>
                <Ionicons name="close-circle" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.label}>Frameworks & Libraries</Text>
        <View style={styles.itemInput}>
          <TextInput
            style={styles.input}
            placeholder="Add framework (e.g., React, Django)"
            placeholderTextColor={Colors.gray}
            value={preferences.currentFramework}
            onChangeText={(text) => setPreferences({ ...preferences, currentFramework: text })}
            onSubmitEditing={() => addItem('frameworks', 'currentFramework')}
          />
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => addItem('frameworks', 'currentFramework')}
          >
            <Ionicons name="add" size={24} color={Colors.background} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.itemsList}>
          {preferences.frameworks.map((framework, index) => (
            <View key={index} style={styles.itemChip}>
              <Text style={styles.itemText}>{framework}</Text>
              <TouchableOpacity onPress={() => removeItem('frameworks', index)}>
                <Ionicons name="close-circle" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Work Style</Text>
        
        <Text style={styles.label}>Schedule Preference</Text>
        <View style={styles.optionRow}>
          {['early-bird', 'nine-to-five', 'night-owl', 'flexible'].map((schedule) => (
            <TouchableOpacity
              key={schedule}
              style={[
                styles.optionButton,
                preferences.workSchedule === schedule && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, workSchedule: schedule })}
            >
              <Text style={[
                styles.optionText,
                preferences.workSchedule === schedule && styles.selectedText
              ]}>
                {schedule.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Experience Level</Text>
        <View style={styles.optionRow}>
          {['junior', 'mid', 'senior', 'principal'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.optionButton,
                preferences.experienceLevel === level && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, experienceLevel: level })}
            >
              <Text style={[
                styles.optionText,
                preferences.experienceLevel === level && styles.selectedText
              ]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Project Type</Text>
        <View style={styles.optionRow}>
          {['frontend', 'backend', 'fullstack', 'mobile'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionButton,
                preferences.projectTypes === type && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, projectTypes: type })}
            >
              <Text style={[
                styles.optionText,
                preferences.projectTypes === type && styles.selectedText
              ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Collaboration</Text>
        
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enjoy Pair Programming</Text>
          <Switch
            value={preferences.pairProgramming}
            onValueChange={(value) => setPreferences({ ...preferences, pairProgramming: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Open to Code Reviews</Text>
          <Switch
            value={preferences.codeReviews}
            onValueChange={(value) => setPreferences({ ...preferences, codeReviews: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Contribute to Open Source</Text>
          <Switch
            value={preferences.openSource}
            onValueChange={(value) => setPreferences({ ...preferences, openSource: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Available for Mentoring</Text>
          <Switch
            value={preferences.mentoring}
            onValueChange={(value) => setPreferences({ ...preferences, mentoring: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Remote Work Preferred</Text>
          <Switch
            value={preferences.remoteWork}
            onValueChange={(value) => setPreferences({ ...preferences, remoteWork: value })}
            trackColor={{ false: Colors.gray, true: Colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Developer Personality</Text>
        
        <Text style={styles.label}>Tabs vs Spaces?</Text>
        <View style={styles.optionRow}>
          {['tabs', 'spaces', '2-spaces', '4-spaces'].map((indent) => (
            <TouchableOpacity
              key={indent}
              style={[
                styles.optionButton,
                preferences.tabsVsSpaces === indent && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, tabsVsSpaces: indent })}
            >
              <Text style={[
                styles.optionText,
                preferences.tabsVsSpaces === indent && styles.selectedText
              ]}>
                {indent.charAt(0).toUpperCase() + indent.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Caffeine Dependency</Text>
        <View style={styles.optionRow}>
          {['none', 'low', 'moderate', 'high'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.optionButton,
                preferences.caffeineDependency === level && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, caffeineDependency: level })}
            >
              <Text style={[
                styles.optionText,
                preferences.caffeineDependency === level && styles.selectedText
              ]}>
                {level === 'high' ? '☕☕☕' : level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Preferred IDE</Text>
        <View style={styles.optionRow}>
          {['vscode', 'vim', 'jetbrains', 'other'].map((ide) => (
            <TouchableOpacity
              key={ide}
              style={[
                styles.optionButton,
                preferences.preferredIDE === ide && styles.selectedOption
              ]}
              onPress={() => setPreferences({ ...preferences, preferredIDE: ide })}
            >
              <Text style={[
                styles.optionText,
                preferences.preferredIDE === ide && styles.selectedText
              ]}>
                {ide === 'vscode' ? 'VS Code' : ide.charAt(0).toUpperCase() + ide.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📚 Learning Goals</Text>
        <View style={styles.itemInput}>
          <TextInput
            style={styles.input}
            placeholder="What do you want to learn next?"
            placeholderTextColor={Colors.gray}
            value={preferences.currentLearningGoal}
            onChangeText={(text) => setPreferences({ ...preferences, currentLearningGoal: text })}
            onSubmitEditing={() => addItem('learningGoals', 'currentLearningGoal')}
          />
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => addItem('learningGoals', 'currentLearningGoal')}
          >
            <Ionicons name="add" size={24} color={Colors.background} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.itemsList}>
          {preferences.learningGoals.map((goal, index) => (
            <View key={index} style={styles.itemChip}>
              <Text style={styles.itemText}>{goal}</Text>
              <TouchableOpacity onPress={() => removeItem('learningGoals', index)}>
                <Ionicons name="close-circle" size={20} color={Colors.gray} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>😄 Fun Stuff</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Your favorite dev joke or quote..."
          placeholderTextColor={Colors.gray}
          value={preferences.favoriteDevJoke}
          onChangeText={(text) => setPreferences({ ...preferences, favoriteDevJoke: text })}
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
          <ActivityIndicator size="small" color={Colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>Save Dev Preferences</Text>
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
    backgroundColor: Colors.background,
  },
  section: {
    backgroundColor: Colors.surface,
    margin: 10,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 10,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  optionButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    backgroundColor: Colors.background,
  },
  selectedOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  selectedText: {
    color: Colors.background,
    fontWeight: 'bold',
  },
  itemInput: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  itemText: {
    color: Colors.primary,
    marginRight: 5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 10,
    padding: 15,
    height: 100,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});