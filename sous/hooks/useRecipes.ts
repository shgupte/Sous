import { Recipe, supabase } from '@/constants/Supabase';
import { useEffect, useState } from 'react';

// API base URL - adjust this to match your server
const API_BASE_URL = 'http://localhost:8000';

export function useRecipes(userId: string | null) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
    } finally {
      setLoading(false);
    }
  };

  const addRecipe = async (name: string, description: string) => {
    if (!userId) return { error: 'User not authenticated' };
    
    setLoading(true);
    setError(null);
    
    try {
      // Clean the description for ChromaDB
      const cleanedDescription = cleanRecipeDescription(description);
      
      // Create a placeholder description for Supabase
      const placeholderDescription = `Recipe: ${name}\n\nRecipe content available via voice assistant.`;
      
      console.log('Inserting recipe with data:', {
        user_id: userId,
        name,
        content: cleanedDescription.substring(0, 100) + '...', // Log truncated version
      });
      
      const { data, error } = await supabase
        .from('recipes')
        .insert([
          {
            user_id: userId,
            name: name,
            content: cleanedDescription, // Use actual recipe content
          },
        ])
        .select()
        .single();

      if (error) throw error;
      
      // Upload full recipe content to ChromaDB
      try {
        const response = await fetch(`${API_BASE_URL}/chroma-upload-recipe/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipe_id: parseInt(data.id.replace(/-/g, '').substring(0, 8), 16), // Convert UUID to int
            user_id: parseInt(userId.replace(/-/g, '').substring(0, 8), 16), // Convert UUID to int
            text: cleanedDescription, // Full recipe content goes to ChromaDB
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Recipe uploaded to ChromaDB successfully:', result.message);
        } else {
          console.error('ChromaDB upload failed:', response.status, response.statusText);
        }
      } catch (chromaError) {
        console.error('Failed to upload to ChromaDB:', chromaError);
        // Don't fail the whole operation if ChromaDB fails
      }
      
      setRecipes(prev => [data, ...prev]);
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add recipe';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Helper function to clean recipe descriptions
  const cleanRecipeDescription = (description: string): string => {
    if (!description) return '';
    
    // Remove common navigation and ad text
    const unwantedPatterns = [
      /skip to content/gi,
      /close/gi,
      /people inc/gi,
      /publishing family/gi,
      /myrecipes dialog/gi,
      /advertisement/gi,
      /subscribe/gi,
      /newsletter/gi,
      /share/gi,
      /comment/gi,
      /footer/gi,
      /navigation/gi,
      /menu/gi,
      /header/gi,
      /sidebar/gi,
      /related/gi,
      /all rights reserved/gi,
      /powered by/gi,
      /cookie/gi,
      /privacy/gi,
      /terms/gi,
    ];
    
    let cleaned = description;
    
    // Remove unwanted patterns
    unwantedPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove excessive whitespace and newlines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace 3+ newlines with 2
    cleaned = cleaned.replace(/\s+/g, ' '); // Replace multiple spaces with single space
    
    // Trim and limit length (Supabase might have limits)
    cleaned = cleaned.trim();
    
    // Limit to reasonable length (e.g., 10,000 characters)
    if (cleaned.length > 10000) {
      cleaned = cleaned.substring(0, 10000) + '...';
    }
    
    return cleaned;
  };

  const parseRecipeFromUrl = async (url: string) => {
    if (!userId) return { error: 'User not authenticated' };
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/parse-recipe/?url=${encodeURIComponent(url)}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse recipe from URL');
      }
      
      const result = await response.json();
      const recipeText = result.message;
      
      // Extract recipe name from URL or use a default
      const urlParts = url.split('/');
      const recipeName = urlParts[urlParts.length - 1]?.replace(/[-_]/g, ' ') || 'Recipe from URL';
      
      // Add the parsed recipe
      return await addRecipe(recipeName, recipeText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse recipe from URL';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateRecipe = async (id: string, name: string, description: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Clean the description for ChromaDB
      const cleanedDescription = cleanRecipeDescription(description);
      
      // Create a placeholder description for Supabase
      const placeholderDescription = `Recipe: ${name}\n\nRecipe content available via voice assistant.`;
      
      const { data, error } = await supabase
        .from('recipes')
        .update({ name, content: cleanedDescription }) // Use actual recipe content
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Update in ChromaDB (delete old, add new)
      try {
        const recipeId = parseInt(id.replace(/-/g, '').substring(0, 8), 16);
        const userIdInt = parseInt(userId!.replace(/-/g, '').substring(0, 8), 16);
        
        // Delete old entry
        await fetch(`${API_BASE_URL}/chroma-delete-recipe/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            user_id: userIdInt,
          }),
        });
        
        // Add new entry with full content
        await fetch(`${API_BASE_URL}/chroma-upload-recipe/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            user_id: userIdInt,
            text: cleanedDescription, // Full recipe content goes to ChromaDB
          }),
        });
        console.log('Recipe updated in ChromaDB successfully');
      } catch (chromaError) {
        console.error('Failed to update in ChromaDB:', chromaError);
      }
      
      setRecipes(prev => prev.map(recipe => 
        recipe.id === id ? data : recipe
      ));
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update recipe';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const deleteRecipe = async (id: string) => {
    console.log('🔄 Starting delete for recipe:', id);
    setLoading(true);
    setError(null);
    
    try {
      console.log('🗑️ Deleting from Supabase...');
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw error;
      }
      
      console.log('✅ Supabase delete successful');
      
      // Delete from ChromaDB
      try {
        const recipeId = parseInt(id.replace(/-/g, '').substring(0, 8), 16);
        const userIdInt = parseInt(userId!.replace(/-/g, '').substring(0, 8), 16);
        
        console.log('🗑️ Deleting from ChromaDB...', { recipeId, userIdInt });
        
        const response = await fetch(`${API_BASE_URL}/chroma-delete-recipe/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            user_id: userIdInt,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ ChromaDB delete successful:', result.message);
        } else {
          console.error('❌ ChromaDB delete failed:', response.status, response.statusText);
        }
      } catch (chromaError) {
        console.error('❌ Failed to delete from ChromaDB:', chromaError);
      }
      
      console.log('🔄 Updating local state...');
      setRecipes(prev => {
        const filtered = prev.filter(recipe => recipe.id !== id);
        console.log(`📊 Removed recipe from local state. Count: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
      
      console.log('✅ Delete operation completed successfully');
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete recipe';
      console.error('❌ Delete operation failed:', errorMessage);
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [userId]);

  return {
    recipes,
    loading,
    error,
    fetchRecipes,
    addRecipe,
    parseRecipeFromUrl,
    updateRecipe,
    deleteRecipe,
  };
}
