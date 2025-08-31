import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { Audio } from 'expo-av';

// --- Helper Function to Create WAV Header (Unchanged) ---
const createWavHeader = (sampleRate: number, bitsPerSample: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const numChannels = 1;

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 0, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, 0, true);

  return buffer;
};

interface VoiceInterfaceProps {
  userId?: string;
  recipeId?: string;
}


const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ 
  userId = 'test', 
  recipeId = 'test' 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  
  // --- Platform-specific refs ---
  // For Mobile (Expo AV)
  const recordingRef = useRef<Audio.Recording | null>(null);
  // For Web (Web Audio API)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(isRecording);

  // Stats for UI
  const [dataSent, setDataSent] = useState(0);
  const [chunksSent, setChunksSent] = useState(0);

  // Define audio parameters
  const audioOptions = {
    sampleRate: 16000,
    channels: 1, // Mono
    bitsPerSample: 16, // 16-bit PCM
    bufferSize: 4096, // Buffer size for ScriptProcessorNode
  };

  useEffect(() => {
  isRecordingRef.current = isRecording;
}, [isRecording]);

  useEffect(() => {
    // Request permissions on component mount
    const requestMicPermission = async () => {
      try {
        if (Platform.OS !== 'web') {
          const { status } = await Audio.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Microphone access is required');
          }
        } else {
           // On web, permission is requested by getUserMedia
           addMessage('Web platform detected. Mic permission will be requested on record.');
        }
      } catch (error) {
        console.error('Error requesting mic permission:', error);
        addMessage(`Error requesting permission: ${error}`);
      }
    };

    requestMicPermission();

    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:8000/listen/${userId}/${recipeId}`;
      wsRef.current = new WebSocket(wsUrl);
      // Set binaryType to 'arraybuffer' to handle raw audio data
      wsRef.current.binaryType = 'arraybuffer';
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('🟢 Connected');
        addMessage('Connected to voice server');
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        addMessage(`📡 Server: ${event.data}`);
      };

      wsRef.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('🔴 Error');
        addMessage('WebSocket connection error');
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        if (isRecording) {
            stopRecording();
        }
        setConnectionStatus('🔴 Disconnected');
        addMessage('Disconnected from voice server');
        wsRef.current = null;
      };

    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to voice server');
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };
  
  const startRecording = async () => {
    if (!isConnected || wsRef.current?.readyState !== WebSocket.OPEN) {
      Alert.alert('Not Connected', 'Please connect to the server first.');
      return;
    }
    
    // Reset stats
    setDataSent(0);
    setChunksSent(0);

    try {
      // Send WAV header first
      const header = createWavHeader(audioOptions.sampleRate, audioOptions.bitsPerSample);
      wsRef.current.send(header);
      addMessage(`WAV header sent (${header.byteLength} bytes)`);

      if (Platform.OS === 'web') {
        await startWebRecording();
      } else {
        await startExpoRecording();
      }
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      addMessage(`Error starting recording: ${error}`);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  // --- NEW: Web Audio API implementation ---
  const startWebRecording = async () => {
    addMessage('Starting web audio recording...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create and configure the AudioContext
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: audioOptions.sampleRate,
      });
      audioContextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      
      // Create a ScriptProcessorNode to get raw audio data
      const processor = context.createScriptProcessor(
        audioOptions.bufferSize,
        1, // input channels (mono)
        1  // output channels (mono)
      );
      scriptProcessorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        console.log('onaudioprocess event fired!'); 
        if (!isRecordingRef || wsRef.current?.readyState !== WebSocket.OPEN) {
          return;
        }

        // Get the raw audio data (Float32Array)
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to PCM16 (Int16Array)
        const pcm16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send the raw PCM16 data as an ArrayBuffer
        wsRef.current.send(pcm16Data.buffer);

        // Update stats
        setDataSent(prev => prev + pcm16Data.buffer.byteLength);
        setChunksSent(prev => prev + 1);
      };
      
      // Connect the audio graph: source -> processor -> destination
      source.connect(processor);
      processor.connect(context.destination); // Required for onaudioprocess to fire

      addMessage('Web audio stream started successfully.');

    } catch (error) {
      addMessage(`Error getting user media: ${error}`);
      throw error; // Propagate error to be caught by startRecording
    }
  };
  
  const startExpoRecording = async () => {
    // This function is for mobile and remains largely the same
    addMessage('Starting Expo audio recording (not implemented for streaming in this example)...');
    // The original `expo-av` recording implementation does not support real-time streaming
    // of raw audio buffers easily. A more advanced library like `react-native-audio-recorder-player`
    // or a custom native module would be needed for true real-time streaming on mobile.
    // For now, this will just record to a file to show the button works.
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      addMessage('Expo recording started (to file, not streaming).');
    } catch (err) {
      console.error('Failed to start Expo recording', err);
    }
  };

  const stopRecording = async () => {
    addMessage('Stopping recording...');
    setIsRecording(false); // Stop the processing loops first

    try {
      if (Platform.OS === 'web') {
        // --- Clean up Web Audio API resources ---
        if (scriptProcessorRef.current) {
          scriptProcessorRef.current.disconnect();
          scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        addMessage('Web audio resources released.');

      } else {
        // --- Clean up Expo AV resources ---
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          recordingRef.current = null;
          addMessage('Expo recording stopped and unloaded.');
        }
      }

      // Send an "end of stream" message to the server
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'stop' }));
        addMessage('Sent end-of-stream message.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      addMessage(`Error stopping recording: ${error}`);
    }
  };

  const addMessage = (message: string) => {
    setMessages((prev: string[]) => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev]);
  };
  
  const clearMessages = () => setMessages([]);

  // The UI remains the same.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Status: {connectionStatus}</Text>
        <Text style={styles.statusText}>Recording: {isRecording ? '🔴 Active' : '⚪ Stopped'}</Text>
        {isRecording && (
          <>
            <Text style={styles.statusText}>Chunks Sent: {chunksSent}</Text>
            <Text style={styles.statusText}>Data Sent: {(dataSent / 1024).toFixed(2)} KB</Text>
          </>
        )}
      </View>

      <View style={styles.buttonRow}>
        {!isConnected ? (
          <TouchableOpacity style={[styles.button, styles.connectButton]} onPress={connectWebSocket}>
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={disconnectWebSocket}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.recordButton, isRecording && styles.buttonRecording, !isConnected && {backgroundColor: '#bdc3c7'}]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!isConnected}
        >
          <Text style={styles.buttonText}>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.messagesContainer}>
        <View style={styles.messagesHeader}>
          <Text style={styles.messagesTitle}>Log</Text>
          <TouchableOpacity onPress={clearMessages} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.messagesScroll} ref={ref => ref?.scrollToEnd({ animated: false })}>
          {messages.slice().reverse().map((message, index) => (
            <Text key={index} style={styles.messageText}>{message}</Text>
          ))}
          {messages.length === 0 && <Text style={styles.noMessages}>No messages yet</Text>}
        </ScrollView>
      </View>
    </View>
  );
};

// --- Your existing styles are fine ---
const styles = StyleSheet.create({
  container: {
   flex: 1,
   padding: 20,
   backgroundColor: '#f8f9fa',
 },
 title: {
   fontSize: 28,
   fontWeight: 'bold',
   textAlign: 'center',
   marginBottom: 20,
   color: '#2c3e50',
 },
 statusContainer: {
   backgroundColor: 'white',
   padding: 15,
   borderRadius: 12,
   marginBottom: 20,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 3,
 },
 statusText: {
   fontSize: 16,
   marginBottom: 8,
   fontWeight: '500',
 },
 buttonRow: {
   flexDirection: 'row',
   justifyContent: 'center',
   marginBottom: 20,
 },
 button: {
   paddingVertical: 15,
   paddingHorizontal: 30,
   borderRadius: 25,
   minWidth: 120,
   alignItems: 'center',
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 3,
 },
 connectButton: {
   backgroundColor: '#27ae60',
 },
 disconnectButton: {
   backgroundColor: '#e74c3c',
 },
 recordButton: {
   backgroundColor: '#3498db',
 },
 buttonRecording: {
   backgroundColor: '#e74c3c',
 },
 buttonText: {
   color: 'white',
   fontSize: 16,
   fontWeight: '600',
 },
 messagesContainer: {
   flex: 1,
   backgroundColor: 'white',
   borderRadius: 12,
   padding: 15,
   marginBottom: 20,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 2 },
   shadowOpacity: 0.1,
   shadowRadius: 4,
   elevation: 3,
 },
 messagesHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 15,
   borderBottomWidth: 1,
   borderBottomColor: '#ecf0f1',
   paddingBottom: 10,
 },
 messagesTitle: {
   fontSize: 18,
   fontWeight: '600',
   color: '#2c3e50',
 },
 clearButton: {
   backgroundColor: '#95a5a6',
   paddingHorizontal: 12,
   paddingVertical: 6,
   borderRadius: 15,
 },
 clearButtonText: {
   color: 'white',
   fontSize: 12,
   fontWeight: '500',
 },
 messagesScroll: {
   flex: 1,
 },
 messageText: {
   fontSize: 14,
   color: '#34495e',
   marginBottom: 8,
   fontFamily: 'monospace',
   backgroundColor: '#f8f9fa',
   padding: 8,
   borderRadius: 6,
 },
 noMessages: {
   textAlign: 'center',
   color: '#95a5a6',
   fontStyle: 'italic',
 },
});

export default VoiceInterface;