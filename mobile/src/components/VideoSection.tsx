import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { config } from '../config';
import { tokens } from '../utils/theme';
import i18n from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_H = (SCREEN_WIDTH * 9) / 16;

export function VideoSection() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const rawUrl = config.faq.videoUrl;
  const videoUrl = rawUrl || '';
  const $t = (k: string) => i18n.t(k);

  const openPlayer = useCallback(() => {
    if (!videoUrl) return;
    setModalVisible(true);
    setError(false);
    setLoading(true);
  }, [videoUrl]);

  const closePlayer = useCallback(() => {
    setModalVisible(false);
    setError(false);
    setLoading(false);
  }, []);

  if (!videoUrl) return null;

  return (
    <>
      {/* Floating pill button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openPlayer}
        style={[styles.floatingPill, { backgroundColor: c.primary }]}
      >
        <Ionicons name="play" size={16} color="#fff" />
        <Text style={styles.pillText}>{$t('faq.videoSectionTitle')}</Text>
      </TouchableOpacity>

      {/* Video modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        onRequestClose={closePlayer}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {$t('faq.videoSectionTitle')}
            </Text>
            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Video area */}
          <View style={styles.playerArea}>
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={c.primary} />
              </View>
            )}
            {error ? (
              <View style={styles.errorWrap}>
                <Ionicons name="alert-circle" size={44} color={c.textTertiary} />
                <Text style={[styles.errorText, { color: c.textSecondary }]}>
                  {$t('faq.videoLoadError')}
                </Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: c.primary }]}
                  onPress={() => { setError(false); setLoading(true); }}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nativeVideoWrap}>
                <TouchableOpacity
                  style={styles.nativeVideo}
                  onPress={() => {}}
                  activeOpacity={1}
                >
                  <Ionicons name="play-circle" size={72} color="#fff" />
                  <Text style={styles.tapPlayText}>Tap to play</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  floatingPill: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing2 + 2,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing6,
    paddingBottom: tokens.spacing3,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    padding: tokens.spacing1,
  },
  playerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing2 + 2,
    borderRadius: tokens.radiusMd,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  nativeVideoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
  },
  nativeVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing3,
  },
  tapPlayText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
});