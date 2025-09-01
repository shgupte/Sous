import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import { IconSymbol } from './ui/IconSymbol';

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
  compact?: boolean; // New prop for compact mode
}

const { width: screenWidth } = Dimensions.get('window');

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ 
  userId = 'test', 
  recipeId = 'test',
  compact = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  
  // --- Platform-specific refs ---
  // For Mobile (Expo AV + Live Audio Stream)
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStatusRef = useRef<Audio.RecordingStatus | null>(null);
  const audioChunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveAudioStreamRef = useRef<any>(null);
  // For Web (Web Audio API)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(isRecording);
  
  // Audio playback refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const isReceivingAudioRef = useRef(false);

  // Audio streaming queue refs
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
      if (audioChunkIntervalRef.current) {
        clearInterval(audioChunkIntervalRef.current);
      }
      if (liveAudioStreamRef.current) {
        LiveAudioStream.stop();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      // Cleanup audio playback
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close();
      }
      audioQueueRef.current = [];
      isPlayingRef.current = false;
    };
  }, []);

  const connectWebSocket = () => {
    try {
      // Use your local server URL - adjust as needed
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
        // Check if the message is binary (audio data) or text (JSON)
        if (event.data instanceof ArrayBuffer) {
          handleAudioResponse(event.data);
        } else {
          handleTextResponse(event.data);
        }
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

  const handleTextResponse = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      addMessage(`📡 Server: ${JSON.stringify(parsed, null, 2)}`);
    } catch (error) {
      addMessage(`📡 Server: ${data}`);
    }
  };

  const handleAudioResponse = (audioData: ArrayBuffer) => {
    // Add debugging to understand the audio format
    console.log('🔍 Audio data received:', {
      byteLength: audioData.byteLength,
      firstBytes: Array.from(new Uint8Array(audioData.slice(0, 16))).map(b => b.toString(16).padStart(2, '0')).join(' '),
      sampleRate: 16000, // Expected sample rate
      expectedChunkSize: audioData.byteLength / 2, // For 16-bit samples
      isWav: isWavFile(audioData),
    });
    
    if (Platform.OS === 'web') {
      playAudioOnWeb(audioData);
    } else {
      playAudioOnMobile(audioData);
    }
  };

  // Helper function to check if data looks like WAV
  const isWavFile = (data: ArrayBuffer): boolean => {
    if (data.byteLength < 12) return false;
    const view = new DataView(data);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    return riff === 'RIFF' && wave === 'WAVE';
  };

  const playAudioOnWeb = async (audioData: ArrayBuffer) => {
    try {
      setIsPlayingAudio(true);
      addMessage('🔊 Processing audio chunk...');

      // Initialize AudioContext if needed
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Check if it's WAV format
      if (isWavFile(audioData)) {
        console.log('🔍 Detected WAV format, using decodeAudioData');
        // Use decodeAudioData for WAV files
        const audioBuffer = await playbackAudioContextRef.current.decodeAudioData(audioData);
        const source = playbackAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackAudioContextRef.current.destination);
        source.onended = () => {
          setIsPlayingAudio(false);
          addMessage('🔊 Audio playback completed');
        };
        source.start(0);
        return;
      }

      // Handle raw PCM data
      console.log('🔍 Processing as raw PCM data');
      
      // Convert raw PCM data to Float32Array
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      
      // Debug the conversion process
      console.log('🔍 Audio conversion:', {
        originalBytes: audioData.byteLength,
        int16Samples: int16Array.length,
        firstInt16Values: Array.from(int16Array.slice(0, 8)),
        maxInt16: Math.max(...Array.from(int16Array)),
        minInt16: Math.min(...Array.from(int16Array)),
      });
      
      // Convert Int16 to Float32 (normalize to [-1, 1])
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      console.log('🔍 Float32 conversion:', {
        firstFloatValues: Array.from(float32Array.slice(0, 8)),
        maxFloat: Math.max(...Array.from(float32Array)),
        minFloat: Math.min(...Array.from(float32Array)),
      });

      // Add to queue
      audioQueueRef.current.push(float32Array);

      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextChunk();
      }

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      addMessage(`Error processing audio: ${error}`);
      setIsPlayingAudio(false);
    }
  };

  const playNextChunk = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlayingAudio(false);
      addMessage('🔊 Audio playback completed');
      return;
    }

    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    
    console.log('🔍 Playing chunk:', {
      chunkLength: chunk.length,
      queueLength: audioQueueRef.current.length,
      chunkMax: Math.max(...Array.from(chunk)),
      chunkMin: Math.min(...Array.from(chunk)),
      sampleRate: playbackAudioContextRef.current!.sampleRate,
      expectedDuration: chunk.length / 16000, // Expected duration in seconds
    });
    
    // Create AudioBuffer from chunk
    const audioBuffer = playbackAudioContextRef.current!.createBuffer(1, chunk.length, 16000);
    audioBuffer.getChannelData(0).set(chunk);

    // Create and play source
    const source = playbackAudioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackAudioContextRef.current!.destination);
    
    audioSourceRef.current = source;
    
    source.onended = () => {
      console.log('🔍 Chunk finished, playing next...');
      // Play next chunk when this one finishes
      playNextChunk();
    };

    source.start(0);
  };

  const playAudioOnMobile = async (audioData: ArrayBuffer) => {
    try {
      setIsPlayingAudio(true);
      addMessage('🔊 Playing audio response...');

      // Convert ArrayBuffer to base64 for Expo Audio
      const uint8Array = new Uint8Array(audioData);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      const audioUri = `data:audio/wav;base64,${base64}`;

      // Load and play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      soundRef.current = sound;

      // Handle playback status updates
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingAudio(false);
          addMessage('🔊 Audio playback completed');
        }
      });

    } catch (error) {
      console.error('Error playing audio on mobile:', error);
      addMessage(`Error playing audio: ${error}`);
      setIsPlayingAudio(false);
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
        await startMobileRecording();
      }
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      addMessage(`Error starting recording: ${error}`);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  // --- Enhanced Mobile Audio Streaming Implementation with Live Audio Stream ---
  const startMobileRecording = async () => {
    addMessage('Starting mobile audio streaming with live audio stream...');
    try {
      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Configure Live Audio Stream
      const options = {
        sampleRate: audioOptions.sampleRate,
        channels: audioOptions.channels,
        bitsPerSample: audioOptions.bitsPerSample,
        audioSource: 6, // VOICE_COMMUNICATION
        bufferSize: audioOptions.bufferSize,
      };

      // Set up the audio stream callback
      LiveAudioStream.on('data', (data: any) => {
        if (isRecordingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert the audio data to the format expected by the server
          const audioBuffer = convertAudioDataToBuffer(data);
          wsRef.current.send(audioBuffer);
          
          // Update stats
          setDataSent(prev => prev + audioBuffer.byteLength);
          setChunksSent(prev => prev + 1);
        }
      });

      // Start the live audio stream
      await LiveAudioStream.start(options);
      liveAudioStreamRef.current = true;

      addMessage('Mobile live audio streaming started successfully.');

    } catch (error) {
      addMessage(`Error starting mobile recording: ${error}`);
      throw error;
    }
  };

  // Function to convert audio data to the correct format
  const convertAudioDataToBuffer = (data: any): ArrayBuffer => {
    // The data format depends on the platform and configuration
    // For most cases, it should be a raw PCM buffer
    if (data instanceof ArrayBuffer) {
      return data;
    } else if (data instanceof Uint8Array) {
      return new Uint8Array(data).buffer;
    } else if (Array.isArray(data)) {
      // Convert array to Int16Array then to ArrayBuffer
      const int16Array = new Int16Array(data);
      return int16Array.buffer;
    } else {
      // Fallback: create a buffer with the data
      const buffer = new ArrayBuffer(data.length || 1024);
      const view = new DataView(buffer);
      if (typeof data === 'string') {
        // Handle string data if needed
        for (let i = 0; i < Math.min(data.length, buffer.byteLength); i++) {
          view.setUint8(i, data.charCodeAt(i));
        }
      }
      return buffer;
    }
  };

  // --- Web Audio API implementation (unchanged) ---
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

  const stopRecording = async () => {
    addMessage('Stopping recording...');
    setIsRecording(false); // Stop the processing loops first

    // Clear the audio chunk interval
    if (audioChunkIntervalRef.current) {
      clearInterval(audioChunkIntervalRef.current);
      audioChunkIntervalRef.current = null;
    }

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
        // --- Clean up Mobile recording resources ---
        if (liveAudioStreamRef.current) {
          await LiveAudioStream.stop();
          liveAudioStreamRef.current = null;
          addMessage('Mobile live audio stream stopped.');
        }
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          recordingRef.current = null;
          recordingStatusRef.current = null;
          addMessage('Mobile recording stopped and unloaded.');
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

  // Compact mode for mobile integration
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactStatusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[styles.statusValue, { color: isConnected ? '#27ae60' : '#e74c3c' }]}>
              {connectionStatus}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Recording:</Text>
            <Text style={[styles.statusValue, { color: isRecording ? '#e74c3c' : '#95a5a6' }]}>
              {isRecording ? 'Active' : 'Stopped'}
            </Text>
          </View>
          {isPlayingAudio && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Audio:</Text>
              <Text style={[styles.statusValue, { color: '#3498db' }]}>
                🔊 Playing
              </Text>
            </View>
          )}
        </View>

        <View style={styles.compactButtonContainer}>
          {!isConnected ? (
            <Pressable 
              style={[styles.compactButton, styles.connectButton]} 
              onPress={connectWebSocket}
            >
              <IconSymbol size={20} name="wifi" color="white" />
              <Text style={styles.compactButtonText}>Connect</Text>
            </Pressable>
          ) : (
            <Pressable 
              style={[styles.compactButton, styles.disconnectButton]} 
              onPress={disconnectWebSocket}
            >
              <IconSymbol size={20} name="wifi.slash" color="white" />
              <Text style={styles.compactButtonText}>Disconnect</Text>
            </Pressable>
          )}

          <Pressable 
            style={[
              styles.compactButton, 
              styles.recordButton, 
              isRecording && styles.buttonRecording,
              !isConnected && styles.buttonDisabled
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
          >
            <IconSymbol 
              size={24} 
              name={isRecording ? "stop.circle.fill" : "mic.fill"} 
              color="white" 
            />
            <Text style={styles.compactButtonText}>
              {isRecording ? 'Stop' : 'Record'}
            </Text>
          </Pressable>
        </View>

        {/* Add the test button */}
        <Pressable 
          style={[styles.compactButton, { backgroundColor: '#9b59b6' }]} 
          onPress={testAudioPlayback}
        >
          <IconSymbol size={20} name="speaker.wave.2.fill" color="white" />
          <Text style={styles.compactButtonText}>Test Audio</Text>
        </Pressable>

        {messages.length > 0 && (
          <View style={styles.compactMessagesContainer}>
            <View style={styles.compactMessagesHeader}>
              <Text style={styles.compactMessagesTitle}>Recent Activity</Text>
              <Pressable onPress={clearMessages}>
                <IconSymbol size={16} name="trash" color="#95a5a6" />
              </Pressable>
            </View>
            <ScrollView style={styles.compactMessagesScroll} showsVerticalScrollIndicator={false}>
              {messages.slice(0, 3).map((message, index) => (
                <Text key={index} style={styles.compactMessageText} numberOfLines={2}>
                  {message}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  // Full mode (original implementation)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Status: {connectionStatus}</Text>
        <Text style={styles.statusText}>Recording: {isRecording ? '🔴 Active' : '⚪ Stopped'}</Text>
        {isPlayingAudio && (
          <Text style={styles.statusText}>Audio: 🔊 Playing Response</Text>
        )}
        {isRecording && (
          <>
            <Text style={styles.statusText}>Chunks Sent: {chunksSent}</Text>
            <Text style={styles.statusText}>Data Sent: {(dataSent / 1024).toFixed(2)} KB</Text>
          </>
        )}
      </View>

      <View style={styles.buttonRow}>
        {!isConnected ? (
          <Pressable style={[styles.button, styles.connectButton]} onPress={connectWebSocket}>
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.disconnectButton]} onPress={disconnectWebSocket}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.buttonRow}>
        <Pressable 
          style={[styles.button, styles.recordButton, isRecording && styles.buttonRecording, !isConnected && {backgroundColor: '#bdc3c7'}]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={!isConnected}
        >
          <Text style={styles.buttonText}>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
        </Pressable>
      </View>

      <View style={styles.messagesContainer}>
        <View style={styles.messagesHeader}>
          <Text style={styles.messagesTitle}>Log</Text>
          <Pressable onPress={clearMessages} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
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

// Add these test functions after your existing functions

// Add this function for testing
const testAudioPlayback = () => {
  console.log('🔊 Testing audio playback...');
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      console.log('🔊 AudioContext resumed for test');
      playTestTone(audioContext);
    });
  } else {
    playTestTone(audioContext);
  }
};

const playTestTone = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
  
  console.log('🔊 Test tone played');
};

// Then add the test button to your UI in the compact mode section:

// --- Updated styles with mobile-first design ---
const styles = StyleSheet.create({
  // Compact mode styles
  compactContainer: {
    width: '100%',
    maxWidth: screenWidth - 40,
  },
  compactStatusCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  compactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transition: 'all 0.2s ease',
      ':hover': {
        transform: 'translateY(-1px)',
        shadowOpacity: 0.2,
      },
    }),
  },
  compactButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  compactMessagesContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactMessagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  compactMessagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  compactMessagesScroll: {
    maxHeight: 80,
  },
  compactMessageText: {
    fontSize: 12,
    color: '#34495e',
    marginBottom: 4,
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    padding: 6,
    borderRadius: 4,
  },

  // Full mode styles (existing)
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
   ...(Platform.OS === 'web' && {
     cursor: 'pointer',
     userSelect: 'none',
     WebkitUserSelect: 'none',
     transition: 'all 0.2s ease',
     ':hover': {
       transform: 'translateY(-1px)',
       shadowOpacity: 0.2,
     },
   }),
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