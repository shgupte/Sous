import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRecipes } from '@/hooks/useRecipes';

export default function HomeScreen() {
  const { user } = useAuth();
  const { recipes } = useRecipes(user?.id || null);
  const colorScheme = useColorScheme();

  const recentRecipes = recipes.slice(0, 3);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome to Sous!</ThemedText>
        <HelloWave />
      </ThemedView>
      
      <ThemedView style={styles.welcomeSection}>
        <ThemedText type="subtitle">Your Recipe Assistant</ThemedText>
        <ThemedText>
          Save your favorite recipes and get voice-guided cooking assistance. 
          Start by adding your first recipe or explore your collection.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.quickActions}>
        <ThemedText type="subtitle">Quick Actions</ThemedText>
        
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint },
          ]}
          onPress={() => router.push('/(tabs)/recipes')}
        >
          <IconSymbol size={24} name="plus" color="white" />
          <ThemedText style={styles.actionButtonText}>Add New Recipe</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.actionButton,
            styles.secondaryButton,
            { borderColor: Colors[colorScheme ?? 'light'].tint },
          ]}
          onPress={() => router.push('/(tabs)/recipes')}
        >
          <IconSymbol size={24} name="book.fill" color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.secondaryButtonText}>View All Recipes</ThemedText>
        </Pressable>
      </ThemedView>

      {recentRecipes.length > 0 && (
        <ThemedView style={styles.recentSection}>
          <ThemedText type="subtitle">Recent Recipes</ThemedText>
          {recentRecipes.map((recipe) => (
            <Pressable
              key={recipe.id}
              style={[
                styles.recipeItem,
                { borderColor: Colors[colorScheme ?? 'light'].tint },
              ]}
              onPress={() => router.push({
                pathname: '/recipe',
                params: { recipeId: recipe.id },
              })}
            >
              <ThemedText type="defaultSemiBold" style={styles.recipeName}>
                {recipe.name}
              </ThemedText>
              <ThemedText style={styles.recipeDescription} numberOfLines={2}>
                {recipe.description}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      <ThemedView style={styles.featuresSection}>
        <ThemedText type="subtitle">Features</ThemedText>
        <ThemedView style={styles.featureItem}>
          <IconSymbol size={20} name="mic.fill" color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.featureText}>
            Voice-guided cooking assistance
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.featureItem}>
          <IconSymbol size={20} name="book.fill" color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.featureText}>
            Save and organize your recipes
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.featureItem}>
          <IconSymbol size={20} name="person.fill" color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.featureText}>
            Secure cloud storage with Supabase
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  welcomeSection: {
    gap: 8,
    marginBottom: 16,
  },
  quickActions: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recentSection: {
    gap: 12,
    marginBottom: 16,
  },
  recipeItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  recipeName: {
    marginBottom: 4,
  },
  recipeDescription: {
    opacity: 0.7,
    lineHeight: 18,
  },
  featuresSection: {
    gap: 12,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
