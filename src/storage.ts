// src/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalPhoto, ProfileState } from './types';
import { saveImageToLocal, deleteImageFromLocal } from './fileManager';

const getUserPhotosKey = (userId: string) => `journal_photos_${userId}`;
const getUserProfileKey = (userId: string) => `journal_profile_${userId}`;

// --- PHOTOS ---
export const loadAll = async (userId: string): Promise<JournalPhoto[]> => {
  try {
    const data = await AsyncStorage.getItem(getUserPhotosKey(userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveAll = async (userId: string, photos: JournalPhoto[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(getUserPhotosKey(userId), JSON.stringify(photos));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des photos:', error);
  }
};

export const addPhoto = async (userId: string, photo: JournalPhoto) => {
  const localPath = await saveImageToLocal(photo.uri);
  if (!localPath) return;
  const photos = await loadAll(userId);
  await saveAll(userId, [{ ...photo, uri: localPath }, ...photos]);
};

export const removePhoto = async (userId: string, uri: string) => {
  const photos = await loadAll(userId);
  await deleteImageFromLocal(uri);
  await saveAll(userId, photos.filter(p => p.uri !== uri));
};

// --- PROFIL ---
export const loadProfile = async (userId: string): Promise<ProfileState> => {
  try {
    const data = await AsyncStorage.getItem(getUserProfileKey(userId));
    return data ? JSON.parse(data) : { name: 'Voyageur', avatarUri: null };
  } catch {
    return { name: 'Voyageur', avatarUri: null };
  }
};

export const saveProfile = async (userId: string, profile: ProfileState): Promise<void> => {
  try {
    await AsyncStorage.setItem(getUserProfileKey(userId), JSON.stringify(profile));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du profil:', error);
  }
};

// --- MIGRATION ---
export const migrateDataToUser = async (userId: string): Promise<void> => {
  try {
    const oldPhotos = await AsyncStorage.getItem('journal_photos');
    if (oldPhotos) {
      await AsyncStorage.setItem(getUserPhotosKey(userId), oldPhotos);
      await AsyncStorage.removeItem('journal_photos');
    }
    const oldProfile = await AsyncStorage.getItem('journal_profile');
    if (oldProfile) {
      await AsyncStorage.setItem(getUserProfileKey(userId), oldProfile);
      await AsyncStorage.removeItem('journal_profile');
    }
  } catch (error) {
    console.error('Erreur lors de la migration des données:', error);
  }
};
