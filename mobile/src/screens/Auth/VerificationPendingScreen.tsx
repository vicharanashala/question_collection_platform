import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useTheme } from '../../hooks/useTheme';
import { tokens } from '../../utils/theme';
import { Button } from '../../components/Button';
import { config } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import { VerificationStatus } from '../../types';

export function VerificationPendingScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { refreshProfile, user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  async function handleCheckVerification() {
    await refreshProfile();
    if (user?.verificationStatus === VerificationStatus.VERIFIED) {
      // Navigate to main app — AuthProvider will pick up the updated user state
    }
  }

  async function handleLogout() {
    setShowLogoutConfirm(false);
    // Navigate to Auth stack (contains LoginPhone) at the root level before auth state clears
    // This ensures the user lands on LoginPhone even if the PendingStack unmounts
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
    await logout();
  }

  function handleLogoutPress() {
    setShowLogoutConfirm(true);
  }

  function handleContactAdmin() {
    if (!config.support.email) return;
    const subject = encodeURIComponent('Account Verification Help');
    const body = encodeURIComponent(
      `Hello,\n\nI have registered on the Farmer Question Platform and my account is pending verification. Please verify my account.\n\nThank you.`,
    );
    Linking.openURL(`mailto:${config.support.email}?subject=${subject}&body=${body}`).catch(() => {});
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={handleCheckVerification}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="refresh-circle" size={26} color={c.primary} />
        </TouchableOpacity>
      </View>
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
            icon="mail-outline"
            iconPosition="left"
          />

          <TouchableOpacity style={styles.logoutRow} onPress={handleLogoutPress}>
            <Ionicons name="log-out-outline" size={16} color={c.textTertiary} />
            <Text style={[styles.logoutText, { color: c.textTertiary }]}>
              {t('verificationPending.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    <ConfirmModal
      visible={showLogoutConfirm}
      title={t('profile.signOut')}
      message={t('profile.signOutConfirm')}
      confirmLabel={t('profile.signOutAction')}
      cancelLabel={t('profile.signOutCancel')}
      variant="default"
      onConfirm={handleLogout}
      onClose={() => setShowLogoutConfirm(false)}
    />
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: tokens.spacing4,
    zIndex: 1,
  },
  headerBtn: {
    padding: tokens.spacing1,
  },
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