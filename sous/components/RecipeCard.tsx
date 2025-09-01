import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { Recipe } from '@/constants/Supabase';
import { useColorScheme } from '@/hooks/useColorScheme';

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: (id: string) => void;
}

export default function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  const colorScheme = useColorScheme();

  const handleStartCooking = () => {
    router.push({
      pathname: '/cooking',
      params: { recipeId: recipe.id, recipeName: recipe.name },
    });
  };

  const handleViewRecipe = () => {
    router.push({
      pathname: '/recipe',
      params: { recipeId: recipe.id },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(recipe.id),
        },
      ]
    );
  };

  return (
    <ThemedView
      style={[
        styles.card,
        {
          borderColor: Colors[colorScheme ?? 'light'].tint,
        },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {recipe.name}
        </ThemedText>
        {onDelete && (
          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <ThemedText style={styles.deleteText}>Delete</ThemedText>
          </Pressable>
        )}
      </View>

      <ThemedText style={styles.description} numberOfLines={3}>
        {recipe.content}
      </ThemedText>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.button,
            styles.viewButton,
            {
              borderColor: Colors[colorScheme ?? 'light'].tint,
            },
          ]}
          onPress={handleViewRecipe}
        >
          <ThemedText style={styles.viewButtonText}>View Recipe</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            styles.cookButton,
            {
              backgroundColor: Colors[colorScheme ?? 'light'].tint,
            },
          ]}
          onPress={handleStartCooking}
        >
          <ThemedText style={styles.cookButtonText}>Start Cooking</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  viewButton: {
    borderWidth: 1,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cookButton: {},
  cookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
