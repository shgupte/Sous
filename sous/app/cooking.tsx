import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceInterface from '@/components/VoiceInterface';
import { Colors } from '@/constants/Colors';
import { Recipe, supabase } from '@/constants/Supabase';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View
} from 'react-native';

export default function CookingScreen() {
  const { recipeId, recipeName } = useLocalSearchParams<{ 
    recipeId: string; 
    recipeName: string;
  }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (recipeId) {
      fetchRecipe();
    }
  }, [recipeId]);

  const fetchRecipe = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (error) throw error;
      setRecipe(data);
    } catch (err) {
      console.error('Failed to fetch recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol size={24} name="chevron.left" color={Colors[colorScheme ?? 'light'].text} />
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Cooking Mode
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.recipeInfo}>
        <ThemedText type="subtitle" style={styles.recipeName}>
          {recipeName || 'Recipe'}
        </ThemedText>
        {recipe && (
          <ThemedText style={styles.recipeDescription} numberOfLines={3}>
            {recipe.content}
          </ThemedText>
        )}
      </View>

      <View style={styles.voiceContainer}>
        <ThemedText type="subtitle" style={styles.voiceTitle}>
          Voice Assistant
        </ThemedText>
        <ThemedText style={styles.voiceDescription}>
          Tap the microphone and ask for cooking help, ingredient substitutions, or step-by-step guidance.
        </ThemedText>
        
        <VoiceInterface 
          userId={recipe?.user_id || 'unknown'} 
          recipeId={recipeId || 'unknown'} 
          compact={true}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  recipeInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  recipeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  recipeDescription: {
    lineHeight: 20,
    opacity: 0.8,
  },
  voiceContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  voiceDescription: {
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
    opacity: 0.8,
    paddingHorizontal: 20,
  },
});
