import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import TerminalService from '../services/TerminalService';

export default function Terminal({ project, onCreateFile, onDeleteFile }) {
  const [history, setHistory] = useState([
    { type: 'info', text: 'DevChat Terminal v1.0.0' },
    { type: 'info', text: 'Type "help" for available commands.' },
    { type: 'prompt', text: '$ ' }
  ]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const executeCommand = async (command) => {
    if (!command.trim()) return;

    // Add command to history
    const newHistory = [...history];
    newHistory[newHistory.length - 1] = { 
      type: 'prompt', 
      text: `$ ${command}` 
    };

    // Execute command
    const result = await TerminalService.executeCommand(command, {
      currentProject: project,
      createFile: onCreateFile,
      deleteFile: onDeleteFile
    });

    // Handle result
    if (result.type === 'clear') {
      setHistory([
        { type: 'info', text: 'DevChat Terminal v1.0.0' },
        { type: 'prompt', text: '$ ' }
      ]);
    } else {
      if (result.output) {
        newHistory.push({ type: result.type, text: result.output });
      }
      newHistory.push({ type: 'prompt', text: '$ ' });
      setHistory(newHistory);
    }

    // Update command history
    setCommandHistory([...commandHistory, command]);
    setHistoryIndex(-1);
    setCurrentCommand('');
  };

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === 'Enter') {
      executeCommand(currentCommand);
    }
  };

  const handleHistoryNavigation = (direction) => {
    if (commandHistory.length === 0) return;

    let newIndex = historyIndex;
    
    if (direction === 'up') {
      newIndex = historyIndex === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === commandHistory.length - 1
        ? -1
        : historyIndex + 1;
    }

    setHistoryIndex(newIndex);
    setCurrentCommand(newIndex === -1 ? '' : commandHistory[newIndex]);
  };

  const getTextStyle = (type) => {
    switch (type) {
      case 'error':
        return styles.errorText;
      case 'success':
        return styles.successText;
      case 'info':
        return styles.infoText;
      case 'prompt':
        return styles.promptText;
      default:
        return styles.outputText;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Terminal</Text>
        <TouchableOpacity onPress={() => executeCommand('clear')}>
          <Ionicons name="trash-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.outputContainer}
        contentContainerStyle={styles.outputContent}
      >
        {history.map((line, index) => (
          <Text key={index} style={[styles.outputLine, getTextStyle(line.type)]}>
            {line.text}
          </Text>
        ))}
      </ScrollView>
      
      <View style={styles.inputContainer}>
        <Text style={styles.prompt}>$ </Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={currentCommand}
          onChangeText={setCurrentCommand}
          onKeyPress={handleKeyPress}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          placeholder="Enter command..."
          placeholderTextColor={Colors.gray}
        />
        <View style={styles.historyButtons}>
          <TouchableOpacity onPress={() => handleHistoryNavigation('up')}>
            <Ionicons name="chevron-up" size={20} color={Colors.gray} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleHistoryNavigation('down')}>
            <Ionicons name="chevron-down" size={20} color={Colors.gray} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e3e',
  },
  headerText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  outputContainer: {
    flex: 1,
    padding: 10,
  },
  outputContent: {
    paddingBottom: 20,
  },
  outputLine: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  outputText: {
    color: '#d4d4d4',
  },
  errorText: {
    color: '#f48771',
  },
  successText: {
    color: '#89d185',
  },
  infoText: {
    color: '#6ab7ff',
  },
  promptText: {
    color: '#c6c6c6',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2d2d2d',
    borderTopWidth: 1,
    borderTopColor: '#3e3e3e',
  },
  prompt: {
    color: '#c6c6c6',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginRight: 5,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    padding: 0,
  },
  historyButtons: {
    flexDirection: 'column',
    marginLeft: 10,
  },
});