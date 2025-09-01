import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface AddRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, description: string) => Promise<void>;
  onParseUrl?: (url: string) => Promise<void>;
  loading?: boolean;
}

export default function AddRecipeModal({
  visible,
  onClose,
  onAdd,
  onParseUrl,
  loading = false,
}: AddRecipeModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const colorScheme = useColorScheme();

  const handleAdd = async () => {
    if (isUrlMode) {
      if (!url.trim()) {
        Alert.alert('Error', 'Please enter a recipe URL');
        return;
      }
      
      if (!onParseUrl) {
        Alert.alert('Error', 'URL parsing is not available');
        return;
      }

      try {
        await onParseUrl(url.trim());
        setUrl('');
        onClose();
      } catch (error) {
        Alert.alert('Error', 'Failed to parse recipe from URL');
      }
    } else {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter a recipe name');
        return;
      }

      if (!description.trim()) {
        Alert.alert('Error', 'Please enter a recipe description');
        return;
      }

      try {
        await onAdd(name.trim(), description.trim());
        setName('');
        setDescription('');
        onClose();
      } catch (error) {
        Alert.alert('Error', 'Failed to add recipe');
      }
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setUrl('');
    onClose();
  };

  const toggleMode = () => {
    setIsUrlMode(!isUrlMode);
    setName('');
    setDescription('');
    setUrl('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ThemedView style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              {isUrlMode ? 'Parse Recipe from URL' : 'Add New Recipe'}
            </ThemedText>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <ThemedText style={styles.closeText}>Cancel</ThemedText>
            </Pressable>
          </View>

          <View style={styles.modeToggle}>
            <Pressable
              style={[
                styles.toggleButton,
                !isUrlMode && styles.toggleButtonActive,
                { borderColor: Colors[colorScheme ?? 'light'].tint }
              ]}
              onPress={() => !isUrlMode && toggleMode()}
            >
              <ThemedText style={[
                styles.toggleText,
                !isUrlMode && styles.toggleTextActive
              ]}>
                Manual Entry
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                isUrlMode && styles.toggleButtonActive,
                { borderColor: Colors[colorScheme ?? 'light'].tint }
              ]}
              onPress={() => isUrlMode && toggleMode()}
            >
              <ThemedText style={[
                styles.toggleText,
                isUrlMode && styles.toggleTextActive
              ]}>
                Parse from URL
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.form}>
            {isUrlMode ? (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Recipe URL</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].background,
                      color: Colors[colorScheme ?? 'light'].text,
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    },
                  ]}
                  placeholder="https://www.example.com/recipe"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                  value={url}
                  onChangeText={setUrl}
                  autoFocus
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <ThemedText style={styles.helpText}>
                  Paste a recipe URL to automatically extract and add the recipe
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Recipe Name</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: Colors[colorScheme ?? 'light'].background,
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                    placeholder="Enter recipe name"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Description</ThemedText>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: Colors[colorScheme ?? 'light'].background,
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                    placeholder="Enter recipe description, ingredients, instructions..."
                    placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

            <Pressable
              style={[
                styles.addButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleAdd}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? (isUrlMode ? 'Parsing...' : 'Adding...') : (isUrlMode ? 'Parse Recipe' : 'Add Recipe')}
              </Text>
            </Pressable>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 20,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transition: 'all 0.2s ease',
      ':hover': {
        opacity: 0.8,
      },
    }),
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
  },
  toggleTextActive: {
    color: 'white',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transition: 'all 0.2s ease',
      ':hover': {
        transform: 'translateY(-1px)',
        opacity: 0.9,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
