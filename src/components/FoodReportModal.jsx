// src/components/FoodReportModal.jsx - Report Missing Foods
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Image, ScrollView, Alert } from 'react-native';
import { X, Camera, Send, AlertTriangle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import { createFoodReport } from '../db';
import * as Haptics from 'expo-haptics';

export default function FoodReportModal({ visible, onClose, initialName = '' }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  
  const [name, setName] = useState(initialName);
  const [ingredients, setIngredients] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take food photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a food name.');
      return;
    }

    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await createFoodReport({
        name: name.trim(),
        ingredients: ingredients.trim() || null,
        notes: notes.trim() || null,
        photoUri: photoUri,
        aiEstimates: null, // Could be populated by AI later
      });

      Alert.alert(
        'Report Saved',
        'Your food report has been saved. It can be submitted as a GitHub issue later.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to save report: ' + e.message);
    }

    setSubmitting(false);
  };

  const handleClose = () => {
    setName('');
    setIngredients('');
    setNotes('');
    setPhotoUri(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <AlertTriangle size={20} color={colors.accent1} />
              <Text style={s.title}>Report Missing Food</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.description}>
              Help improve our database by reporting foods that aren't available or have incorrect data.
            </Text>

            <Text style={s.label}>Food Name *</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Mom's homemade lasagna"
              placeholderTextColor={colors.textDim}
            />

            <Text style={s.label}>Ingredients (optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={ingredients}
              onChangeText={setIngredients}
              placeholder="List main ingredients if known..."
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={3}
            />

            <Text style={s.label}>Additional Notes (optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any other details about this food..."
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={2}
            />

            <Text style={s.label}>Photo (optional)</Text>
            {photoUri ? (
              <View style={s.photoContainer}>
                <Image source={{ uri: photoUri }} style={s.photo} />
                <TouchableOpacity style={s.removePhoto} onPress={() => setPhotoUri(null)}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.photoButtons}>
                <TouchableOpacity style={s.photoBtn} onPress={pickImage}>
                  <Camera size={20} color={colors.primary} />
                  <Text style={s.photoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={pickFromGallery}>
                  <Text style={s.photoBtnText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.submitSection}>
              <TouchableOpacity 
                style={[s.submitBtn, submitting && s.submitBtnDisabled]} 
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Send size={18} color={colors.primaryText} />
                <Text style={s.submitBtnText}>{submitting ? 'Saving...' : 'Save Report'}</Text>
              </TouchableOpacity>
              <Text style={s.hint}>
                Reports are saved locally. You can submit them as GitHub issues from Settings.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { padding: 16 },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: colors.surfaceInput, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.surfaceBorder },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  photoContainer: { position: 'relative', marginTop: 8 },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  photoButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  photoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceInput, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.surfaceBorder },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  submitSection: { marginTop: 24, marginBottom: 40 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, padding: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.primaryText },
  hint: { fontSize: 11, color: colors.textDim, textAlign: 'center', marginTop: 12 },
});
