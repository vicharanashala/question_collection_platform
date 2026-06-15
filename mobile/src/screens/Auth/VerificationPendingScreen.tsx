import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { tokens } from '../../utils/theme';
import { Button } from '../../components/Button';

const SUPPORT_WHATSAPP_NUMBER = '919876543210'; // Replace with actual admin/support number

export function VerificationPendingScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  function handleLogout() {
    const { clearAuth } = require('../../api/client');
    clearAuth().then(() => {
      require('@react-navigation/native').CommonActions.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    });
  }

  function handleContactAdmin() {
    const message = encodeURIComponent(
      `Hello, I have registered on the Farmer Question Platform and my account is pending verification. Please verify my account.\n\nThank you.`,
    );
    const whatsappUrl = Platform.select({
      ios: `whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER}&text=${message}`,
      android: `whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER}&text=${message}`,
    }) ?? `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${message}`;

    Linking.canOpenURL(whatsappUrl).then((supported) => {
      if (supported) {
        Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp
        Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${message}`);
      }
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: c.warning + '18' }]}>
          <Ionicons name="shield-checkmark" size={48} color={c.warning} />
        </View>

        {/* Heading */}
        <Text style={[styles.title, { color: c.text }]}>{t('verificationPending.title')}</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          {t('verificationPending.subtitle')}
        </Text>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: c.surface, borderColor: c.borderSubtle }]}>
          <Ionicons name="information-circle-outline" size={20} color={c.primary} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: c.textSecondary }]}>
            {t('verificationPending.infoText')}
          </Text>
        </View>

        {/* Status note */}
        <View style={[styles.statusNote, { backgroundColor: c.warning + '10', borderColor: c.warning + '30' }]}>
          <Ionicons name="time-outline" size={18} color={c.warning} />
          <Text style={[styles.statusNoteText, { color: c.warning }]}>
            {t('verificationPending.statusNote')}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button
            title={t('verificationPending.contactAdmin')}
            onPress={handleContactAdmin}
            variant="secondary"
            icon="logo-whatsapp"
            iconPosition="left"
          />

          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={c.textTertiary} />
            <Text style={[styles.logoutText, { color: c.textTertiary }]}>
              {t('verificationPending.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: tokens.spacing6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: tokens.spacing2,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: tokens.spacing6,
    paddingHorizontal: tokens.spacing4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing4,
    gap: tokens.spacing3,
    alignSelf: 'stretch',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing6,
    gap: tokens.spacing2,
    alignSelf: 'stretch',
  },
  statusNoteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actions: {
    alignSelf: 'stretch',
    gap: tokens.spacing4,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    paddingVertical: tokens.spacing2,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
});