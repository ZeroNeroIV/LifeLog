// src/components/NutritionChat.jsx - AI Chat Interface for Food Logging
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { Send, Check, X, Bot, AlertCircle, Mic, MicOff } from 'lucide-react-native';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useTheme } from '../theme';
import { initializeLLM, isLLMReady, processMessage, logFoodsFromResponse, getCurrentConversationId } from '../services/llm/NutritionLLMService';
import { getConversationMessages } from '../db';

export default function NutritionChat({ modelReady, onFoodLogged }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const flatListRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState(null);
  const [pendingFoods, setPendingFoods] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [partialResults, setPartialResults] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modelReady) initChat();
  }, [modelReady]);

  // Speech recognition event handlers
  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setVoiceError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setPartialResults('');
  });

  useSpeechRecognitionEvent('result', (event) => {
    console.log('[STT Result Event]', JSON.stringify(event, null, 2));
    
    // Try different possible structures from expo-speech-recognition
    const results = event.results || event.transcripts;
    
    if (results && results.length > 0) {
      const result = results[results.length - 1];
      console.log('[STT Result]', JSON.stringify(result, null, 2));
      
      // Try different property names
      const transcript = result.transcript || result.transcription || result.text;
      const isFinal = result.isFinal !== undefined ? result.isFinal : result.final;
      
      console.log('[STT] Extracted:', { transcript, isFinal });
      
      if (transcript) {
        if (isFinal) {
          console.log('[STT] Adding final transcript:', transcript);
          setInput(prev => {
            const newValue = prev ? `${prev} ${transcript}` : transcript;
            console.log('[STT] New input value:', newValue);
            return newValue;
          });
          setPartialResults('');
        } else {
          console.log('[STT] Showing partial results:', transcript);
          setPartialResults(transcript);
        }
      } else {
        console.log('[STT] No transcript found in result');
      }
    } else {
      console.log('[STT] No results in event');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Voice error:', event);
    setIsListening(false);
    setPartialResults('');
    // Don't show error for user cancellation or no speech detected
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      setVoiceError(event.message || 'Voice recognition failed');
      setTimeout(() => setVoiceError(null), 3000);
    }
  });

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  // Typing indicator animation
  useEffect(() => {
    if (isTyping) {
      const typing = Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      typing.start();
      return () => typing.stop();
    } else {
      typingAnim.setValue(0);
    }
  }, [isTyping, typingAnim]);

  const startListening = async () => {
    try {
      setVoiceError(null);
      setPartialResults('');
      
      // Check/request permissions
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setVoiceError('Microphone permission denied');
        setTimeout(() => setVoiceError(null), 3000);
        return;
      }

      // Start recognition
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (e) {
      console.error('Failed to start voice:', e);
      setVoiceError('Could not start voice recognition');
      setTimeout(() => setVoiceError(null), 3000);
    }
  };

  const stopListening = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.error('Failed to stop voice:', e);
    }
    setIsListening(false);
    setPartialResults('');
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const initChat = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      await initializeLLM();
      // Load existing messages if any
      const convId = getCurrentConversationId();
      if (convId) {
        const existing = await getConversationMessages(convId);
        setMessages(existing.map(m => ({ id: m.id, role: m.role, content: m.content })));
      }
    } catch (e) {
      console.error('LLM init error:', e);
      setInitError(e.message);
    }
    setIsInitializing(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setStreamingText('');

    try {
      const response = await processMessage(userMsg.content, (token) => {
        setIsTyping(false); // Hide typing indicator once streaming starts
        setStreamingText(prev => prev + token);
      });

      const assistantMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: response.text };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingText('');
      setIsTyping(false);

      if (response.type === 'meal_log' && response.foods?.length) {
        setPendingFoods(response);
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', content: `Error: ${e.message}` }]);
      setIsTyping(false);
    }
    setIsLoading(false);
  };

  const confirmFoods = async () => {
    if (!pendingFoods) return;
    try {
      await logFoodsFromResponse(pendingFoods);
      setMessages(prev => [...prev, { id: 'logged-' + Date.now(), role: 'system', content: '✓ Foods logged successfully!' }]);
      if (onFoodLogged) onFoodLogged(); // Refresh parent data
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', content: `Failed to log: ${e.message}` }]);
    }
    setPendingFoods(null);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';
    
    return (
      <View style={[s.msgContainer, isUser && s.msgUser, isSystem && s.msgSystem]}>
        <Text style={[s.msgText, isUser && s.msgTextUser, isSystem && s.msgTextSystem]}>
          {item.content}
        </Text>
      </View>
    );
  };

  if (!modelReady) {
    return (
      <View style={s.placeholder}>
        <Bot size={48} color={colors.textDim} />
        <Text style={s.placeholderTitle}>AI Nutrition Assistant</Text>
        <Text style={s.placeholderText}>Download the AI model above to start logging food with natural language</Text>
        <Text style={s.placeholderHint}>You can still use the History tab to manually add foods</Text>
      </View>
    );
  }

  if (isInitializing) {
    return (
      <View style={s.placeholder}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={s.placeholderTitle}>Loading AI Model</Text>
        <Text style={s.placeholderText}>This may take a moment on first launch...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={s.placeholder}>
        <AlertCircle size={48} color={colors.danger} />
        <Text style={s.placeholderTitle}>Failed to Load Model</Text>
        <Text style={s.placeholderText}>{initError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={initChat}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={s.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <Text style={s.emptyChatText}>Tell me what you ate!</Text>
            <Text style={s.emptyChatHint}>e.g., "I had 2 eggs and toast for breakfast"</Text>
          </View>
        }
        ListFooterComponent={
          <>
            {isTyping && (
              <View style={[s.msgContainer, s.typingContainer]}>
                <View style={s.typingDots}>
                  <Animated.View style={[s.dot, { opacity: typingAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 1, 0.3, 0.3] }) }]} />
                  <Animated.View style={[s.dot, { opacity: typingAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 1, 0.3] }) }]} />
                  <Animated.View style={[s.dot, { opacity: typingAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 0.3, 1] }) }]} />
                </View>
              </View>
            )}
            {streamingText && !isTyping ? (
              <View style={s.msgContainer}>
                <Text style={s.msgText}>{streamingText}</Text>
              </View>
            ) : null}
          </>
        }
      />

      {pendingFoods && (
        <View style={s.confirmBar}>
          <View style={s.confirmContent}>
            <Text style={s.confirmTitle}>Found {pendingFoods.foods.length} food item(s):</Text>
            {pendingFoods.foods.map((food, idx) => (
              <Text key={idx} style={s.confirmFoodItem}>
                • {food.name}: {food.calories} cal (P:{food.protein_g}g C:{food.carbs_g}g F:{food.fat_g}g)
              </Text>
            ))}
            <Text style={s.confirmAction}>Add to {pendingFoods.mealType} history?</Text>
          </View>
          <View style={s.confirmBtns}>
            <TouchableOpacity style={[s.confirmBtn, s.confirmBtnYes]} onPress={confirmFoods}>
              <Check size={20} color="#fff" />
              <Text style={s.confirmBtnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.confirmBtn, s.confirmBtnNo]} onPress={() => setPendingFoods(null)}>
              <X size={20} color={colors.danger} />
              <Text style={s.confirmBtnTextNo}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Voice error message */}
      {voiceError && (
        <View style={s.voiceErrorBar}>
          <Text style={s.voiceErrorText}>{voiceError}</Text>
        </View>
      )}

      {/* Partial results while speaking */}
      {isListening && partialResults ? (
        <View style={s.partialBar}>
          <Text style={s.partialText}>{partialResults}</Text>
        </View>
      ) : null}

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={isListening ? "Listening..." : "What did you eat?"}
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          editable={!isListening}
        />
        
        {/* Microphone button */}
        <Animated.View style={{ transform: [{ scale: isListening ? pulseAnim : 1 }] }}>
          <TouchableOpacity 
            style={[s.micBtn, isListening && s.micBtnActive]} 
            onPress={toggleVoice}
            disabled={isLoading}
          >
            {isListening ? (
              <MicOff size={20} color="#fff" />
            ) : (
              <Mic size={20} color={colors.text} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Send button */}
        <TouchableOpacity 
          style={[s.sendBtn, (!input.trim() || isLoading || isListening) && s.sendBtnDisabled]} 
          onPress={sendMessage} 
          disabled={!input.trim() || isLoading || isListening}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryText} size="small" />
          ) : (
            <Send size={20} color={colors.primaryText} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  placeholderText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  placeholderHint: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: 8 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  messagesList: { padding: 16, paddingBottom: 16 },
  emptyChat: { alignItems: 'center', paddingVertical: 40 },
  emptyChatText: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyChatHint: { fontSize: 13, color: colors.textDim, marginTop: 8 },
  msgContainer: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 8, maxWidth: '85%', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.surfaceBorder },
  msgUser: { backgroundColor: colors.primaryBg, alignSelf: 'flex-end', borderColor: colors.primary + '40' },
  msgSystem: { backgroundColor: colors.surfaceInput, alignSelf: 'center', maxWidth: '90%' },
  msgText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  msgTextUser: { color: colors.text },
  msgTextSystem: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  confirmBar: { backgroundColor: colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, maxHeight: 250 },
  confirmContent: { marginBottom: 12 },
  confirmTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  confirmFoodItem: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 4 },
  confirmAction: { fontSize: 13, color: colors.primary, marginTop: 8, fontWeight: '600' },
  confirmBtns: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  confirmBtnYes: { backgroundColor: colors.primary },
  confirmBtnNo: { backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.surfaceBorder },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  confirmBtnTextNo: { fontSize: 14, fontWeight: '700', color: colors.danger },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceInput, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  // Voice input styles
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInput, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder },
  micBtnActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  voiceErrorBar: { backgroundColor: colors.danger + '20', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.danger + '40' },
  voiceErrorText: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  partialBar: { backgroundColor: colors.primaryBg, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.primary + '40' },
  partialText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  // Typing indicator styles
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  typingDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text },
});
