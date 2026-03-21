// src/components/ModelDownloadCard.jsx - LLM Model Download UI
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Download, CheckCircle, AlertCircle, Trash2, HardDrive } from 'lucide-react-native';
import { useTheme } from '../theme';
import { getModelInfo, downloadModel, deleteModel, formatBytes, checkSpaceForDownload, getModelSizes } from '../services/llm/modelDownload';

export default function ModelDownloadCard({ onModelReady }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  
  const [status, setStatus] = useState('checking'); // checking | not_downloaded | downloading | ready | error | no_space
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState(null);
  const [spaceInfo, setSpaceInfo] = useState(null);

  useEffect(() => { checkModelStatus(); }, []);

  const checkModelStatus = async () => {
    setStatus('checking');
    try {
      const info = await getModelInfo();
      if (info.isDownloaded) {
        setStatus('ready');
        onModelReady?.(true);
      } else {
        const space = await checkSpaceForDownload();
        setSpaceInfo(space);
        setStatus(space.hasSpace ? 'not_downloaded' : 'no_space');
      }
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  const handleDownload = async () => {
    setStatus('downloading');
    setError(null);
    try {
      await downloadModel((p) => {
        setProgress(p.progress);
        setDownloadedBytes(p.downloadedBytes);
        setTotalBytes(p.totalBytes);
        if (p.status === 'completed') {
          setStatus('ready');
          onModelReady?.(true);
        } else if (p.status === 'error') {
          setError(p.error);
          setStatus('error');
        }
      });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteModel();
      onModelReady?.(false);
      checkModelStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  const sizes = getModelSizes();

  return (
    <View style={s.card}>
      <View style={s.header}>
        <HardDrive size={20} color={colors.primary} />
        <Text style={s.title}>AI Model</Text>
      </View>

      {status === 'checking' && (
        <View style={s.content}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.statusText}>Checking model status...</Text>
        </View>
      )}

      {status === 'not_downloaded' && (
        <View style={s.content}>
          <Text style={s.description}>
            Download the AI model (~{formatBytes(sizes.primary)}) to enable natural language food logging.
          </Text>
          {spaceInfo && (
            <Text style={s.spaceText}>Available: {formatBytes(spaceInfo.available)}</Text>
          )}
          <TouchableOpacity style={s.downloadBtn} onPress={handleDownload}>
            <Download size={18} color={colors.primaryText} />
            <Text style={s.downloadBtnText}>Download Model</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'downloading' && (
        <View style={s.content}>
          <View style={s.progressContainer}>
            <View style={[s.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={s.progressText}>
            {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)} ({Math.round(progress * 100)}%)
          </Text>
          <Text style={s.statusText}>Downloading... Keep app open</Text>
        </View>
      )}

      {status === 'ready' && (
        <View style={s.content}>
          <View style={s.readyRow}>
            <CheckCircle size={20} color="#22c55e" />
            <Text style={s.readyText}>Model ready</Text>
          </View>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Trash2 size={16} color={colors.danger} />
            <Text style={s.deleteBtnText}>Delete Model</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'no_space' && (
        <View style={s.content}>
          <AlertCircle size={24} color={colors.accent1} />
          <Text style={s.errorText}>
            Not enough storage. Need {formatBytes(sizes.primary)}, have {formatBytes(spaceInfo?.available || 0)}.
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View style={s.content}>
          <AlertCircle size={24} color={colors.danger} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={checkModelStatus}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceBorder },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, letterSpacing: 1 },
  content: { alignItems: 'center', gap: 12 },
  description: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  spaceText: { fontSize: 12, color: colors.textDim },
  statusText: { fontSize: 12, color: colors.textDim },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  downloadBtnText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  progressContainer: { width: '100%', height: 8, backgroundColor: colors.surfaceInput, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  progressText: { fontSize: 13, fontWeight: '600', color: colors.text },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readyText: { fontSize: 14, fontWeight: '600', color: '#22c55e' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  deleteBtnText: { fontSize: 12, color: colors.danger },
  errorText: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.surfaceInput, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
