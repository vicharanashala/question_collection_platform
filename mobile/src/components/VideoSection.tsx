import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { config } from '../config';
import { tokens } from '../utils/theme';
import i18n from '../i18n';

const $t = (k: string) => i18n.t(k);

/**
 * videoUrl         — raw YouTube embed URL (used by web)
 * videoEmbedUrl    — backend HTML page that wraps the iframe (used by mobile)
 *
 * On mobile, loading an HTML blob from file:// means YouTube sees no valid
 * referer and throws Error 152. Serving from our HTTPS API origin fixes this.
 */
const { videoUrl, videoEmbedUrl } = config.faq;

function isYouTubeEmbedUrl(url: string): boolean {
  return url.includes('youtube.com/embed/');
}

export function VideoSection() {
  const { theme } = useTheme();
  const c = theme.colors;
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const openPlayer = useCallback(() => {
    if (!videoEmbedUrl && !videoUrl) return;
    setModalVisible(true);
    setLoading(true);
  }, []);

  const closePlayer = useCallback(() => {
    setModalVisible(false);
    setLoading(false);
  }, []);

  if (!videoEmbedUrl && !videoUrl) return null;

  function VideoModal({ webViewSource }: { webViewSource: { uri: string } }) {
    return (
      <Modal
        visible={modalVisible}
        animationType="fade"
        onRequestClose={closePlayer}
        statusBarTranslucent
      >
        <View style={[styles.modalBackdrop, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: c.surface, paddingTop: tokens.spacing3 }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {$t('faq.videoSectionTitle')}
            </Text>
            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* WebView player */}
          <View style={styles.playerWrap}>
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={c.primary} />
              </View>
            )}
            <WebView
              ref={webViewRef}
              source={webViewSource}
              style={styles.webview}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onLoadEnd={() => setLoading(false)}
              onError={() => setLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
            />
          </View>
        </View>
      </Modal>
    );
  }

  // YouTube embed via WebView — prefer the backend embed page on mobile
  if (isYouTubeEmbedUrl(videoUrl) || videoEmbedUrl) {
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

        <VideoModal
          webViewSource={
            videoEmbedUrl
              ? { uri: videoEmbedUrl }
              : { uri: videoUrl }
          }
        />
      </>
    );
  }

  // Fallback: direct MP4
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

      <VideoModal webViewSource={{ uri: videoUrl }} />
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
    paddingBottom: tokens.spacing3,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    padding: tokens.spacing1,
  },
  playerWrap: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});