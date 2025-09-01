import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Recipe, supabase } from '@/constants/Supabase';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

export default function RecipeScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : 'Failed to fetch recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCooking = () => {
    if (recipe) {
      router.push({
        pathname: '/cooking',
        params: { recipeId: recipe.id, recipeName: recipe.name },
      });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', recipeId);

              if (error) throw error;
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete recipe');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color={Colors[colorScheme ?? 'light'].text} />
          </Pressable>
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !recipe) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol size={24} name="chevron.left" color={Colors[colorScheme ?? 'light'].text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            {error || 'Recipe not found'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol size={24} name="chevron.left" color={Colors[colorScheme ?? 'light'].text} />
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          {recipe.name}
        </ThemedText>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <IconSymbol size={24} name="trash" color="#FF3B30" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.recipeInfo}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recipe Details
          </ThemedText>
          <ThemedText style={styles.description}>
            {recipe.content?.includes('Recipe content available via voice assistant') 
              ? 'This recipe is available through the voice assistant. Tap "Start Cooking" below to get step-by-step cooking guidance, ingredient substitutions, and cooking tips.'
              : recipe.content || 'No recipe content available'}
          </ThemedText>
        </View>

        {recipe.created_at && (
          <View style={styles.recipeInfo}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Created
            </ThemedText>
            <ThemedText style={styles.date}>
              {new Date(recipe.created_at).toLocaleDateString()}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.cookButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint },
          ]}
          onPress={handleStartCooking}
        >
          <IconSymbol size={20} name="mic.fill" color="white" />
          <ThemedText style={styles.cookButtonText}>Start Cooking</ThemedText>
        </Pressable>
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
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
  },
  loadingText: {
    flex: 1,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#D32F2F',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  recipeInfo: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    lineHeight: 24,
    fontSize: 16,
  },
  date: {
    fontSize: 14,
    opacity: 0.7,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  cookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
