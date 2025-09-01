import AddRecipeModal from '@/components/AddRecipeModal';
import RecipeCard from '@/components/RecipeCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRecipes } from '@/hooks/useRecipes';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

export default function RecipesScreen() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { user } = useAuth();
  const { recipes, loading, error, addRecipe, parseRecipeFromUrl, deleteRecipe, fetchRecipes } = useRecipes(user?.id || null);
  const colorScheme = useColorScheme();

  const handleAddRecipe = async (name: string, description: string) => {
    const result = await addRecipe(name, description);
    if (result.error) {
      throw new Error(result.error);
    }
  };

  const handleParseRecipeFromUrl = async (url: string) => {
    const result = await parseRecipeFromUrl(url);
    if (result.error) {
      throw new Error(result.error);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    console.log('🔄 UI: Delete button pressed for recipe:', id);
    try {
      const result = await deleteRecipe(id);
      if (result.error) {
        console.error('❌ UI: Delete failed:', result.error);
        // You might want to show an alert here
        Alert.alert('Delete Failed', result.error);
      } else {
        console.log('✅ UI: Delete successful');
      }
    } catch (error) {
      console.error('❌ UI: Delete error:', error);
      Alert.alert('Delete Error', 'An unexpected error occurred while deleting the recipe.');
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconSymbol 
        size={64} 
        name="book" 
        color={Colors[colorScheme ?? 'light'].tabIconDefault} 
      />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No Recipes Yet
      </ThemedText>
      <ThemedText style={styles.emptyText}>
        Start by adding your first recipe to get cooking!
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          My Recipes
        </ThemedText>
        <Pressable
          style={[
            styles.addButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint },
          ]}
          onPress={() => setShowAddModal(true)}
        >
          <IconSymbol size={20} name="plus" color="white" />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecipeCard recipe={item} onDelete={handleDeleteRecipe} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchRecipes}
            tintColor={Colors[colorScheme ?? 'light'].tint}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      <AddRecipeModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddRecipe}
        onParseUrl={handleParseRecipeFromUrl}
        loading={loading}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 40,
  },
});
