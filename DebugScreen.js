import Constants from 'expo-constants';
import * as Device from 'expo-device';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function DebugScreen() {
  const [logs, setLogs] = useState([]);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', args);
      setErrorCount(prev => prev + 1);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    // Capture global errors
    const errorHandler = (error, isFatal) => {
      addLog('error', [`${isFatal ? 'FATAL' : 'ERROR'}: ${error}`]);
    };

    global.ErrorUtils.setGlobalHandler(errorHandler);

    // Test log
    console.log('Debug screen initialized');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const addLog = (type, args) => {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    setLogs(prev => [{
      id: Date.now(),
      type,
      timestamp,
      message
    }, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const clearLogs = () => {
    setLogs([]);
    setErrorCount(0);
  };

  const testFirebase = async () => {
    try {
      const { auth, db } = require('./firebase');
      console.log('Firebase auth:', auth ? 'Loaded' : 'Not loaded');
      console.log('Firebase db:', db ? 'Loaded' : 'Not loaded');
      console.log('Current user:', auth.currentUser);
    } catch (error) {
      console.error('Firebase test error:', error.message);
    }
  };

  const getDeviceInfo = () => {
    return {
      'Device': Device.deviceName,
      'Model': Device.modelName,
      'OS': Device.osName + ' ' + Device.osVersion,
      'Expo SDK': Constants.expoConfig?.sdkVersion || 'Unknown',
      'App Version': Constants.expoConfig?.version || 'Unknown',
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Console</Text>
        <Text style={styles.errorCount}>Errors: {errorCount}</Text>
      </View>

      <View style={styles.deviceInfo}>
        {Object.entries(getDeviceInfo()).map(([key, value]) => (
          <Text key={key} style={styles.infoText}>{key}: {value}</Text>
        ))}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={testFirebase}>
          <Text style={styles.buttonText}>Test Firebase</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => {
          console.log('Test log message');
          console.error('Test error message');
          console.warn('Test warning message');
        }}>
          <Text style={styles.buttonText}>Test Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log) => (
          <View key={log.id} style={[styles.logItem, styles[log.type]]}>
            <Text style={styles.timestamp}>{log.timestamp}</Text>
            <Text style={styles.logMessage}>{log.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 15,
    paddingTop: 50,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorCount: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceInfo: {
    backgroundColor: '#e0e0e0',
    padding: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#333',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
  },
  logItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  log: {
    backgroundColor: '#fff',
  },
  error: {
    backgroundColor: '#ffebee',
  },
  warn: {
    backgroundColor: '#fff3cd',
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});