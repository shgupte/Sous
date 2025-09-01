import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Profile
        </ThemedText>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <IconSymbol 
            size={80} 
            name="person.circle.fill" 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
        </View>
        
        <View style={styles.userInfo}>
          <ThemedText type="subtitle" style={styles.email}>
            {user?.email}
          </ThemedText>
          <ThemedText style={styles.userId}>
            User ID: {user?.id}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.signOutButton,
            {
              borderColor: '#FF3B30',
            },
          ]}
          onPress={handleSignOut}
        >
          <IconSymbol size={20} name="rectangle.portrait.and.arrow.right" color="#FF3B30" />
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.version}>
          Sous - Recipe Assistant
        </ThemedText>
        <ThemedText style={styles.version}>
          Version 1.0.0
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 40,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userInfo: {
    alignItems: 'center',
  },
  email: {
    fontSize: 18,
    marginBottom: 8,
  },
  userId: {
    fontSize: 14,
    opacity: 0.6,
  },
  actions: {
    marginBottom: 40,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  version: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 4,
  },
});
