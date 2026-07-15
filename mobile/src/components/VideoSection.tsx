import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { config } from '../config';
import { tokens } from '../utils/theme';
import i18n from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_H = (SCREEN_WIDTH * 9) / 16;

const $t = (k: string) => i18n.t(k);

/** YouTube embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1) */
const VIDEO_URL = config.faq.videoUrl;

function isYouTubeEmbedUrl(url: string): boolean {
  return url.includes('youtube.com/embed/');
}

export function VideoSection() {
  const { theme } = useTheme();
  const c = theme.colors;
  const webViewRef = useRef<WebView>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const openPlayer = useCallback(() => {
    if (!VIDEO_URL) return;
    setModalVisible(true);
    setLoading(true);
  }, []);

  const closePlayer = useCallback(() => {
    setModalVisible(false);
    setLoading(false);
  }, []);

  if (!VIDEO_URL) return null;

  // YouTube embed via WebView
  if (isYouTubeEmbedUrl(VIDEO_URL)) {
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

            {/* WebView player */}
            <View style={{ flex: 1 }}>
              {loading && (
                <View style={[styles.loader, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 }]}>
                  <ActivityIndicator size="large" color={c.primary} />
                </View>
              )}
              <WebView
                ref={webViewRef}
                source={{ uri: VIDEO_URL }}
                style={[styles.webview, { aspectRatio: 16 / 9 }]}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onLoadEnd={() => setLoading(false)}
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Fallback: direct MP4 via video tag (not recommended on mobile)
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openPlayer}
        style={[styles.floatingPill, { backgroundColor: c.primary }]}
      >
        <Ionicons name="play" size={16} color="#fff" />
        <Text style={styles.pillText}>{$t('faq.videoSectionTitle')}</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        onRequestClose={closePlayer}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalHeader, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {$t('faq.videoSectionTitle')}
            </Text>
            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerArea}>
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={c.primary} />
              </View>
            )}
            <View style={styles.nativeVideoWrap}>
              <WebView
                ref={webViewRef}
                source={{ uri: VIDEO_URL }}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onLoadEnd={() => setLoading(false)}
              />
            </View>
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
    zIndex: 2,
  },
  nativeVideoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});