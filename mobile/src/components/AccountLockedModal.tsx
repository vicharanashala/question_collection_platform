import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAccountLocked } from '../context/AccountLockedContext';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '../utils/theme';

export function AccountLockedModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { lockedInfo, clearLocked } = useAccountLocked();
  const { logout } = useAuth();

  const isBan = lockedInfo?.status === 'banned';
  const accentColor = isBan ? c.error : c.warning;

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch { return null; }
  };

  const handleLogout = async () => {
    clearLocked();
    await logout();
  };

  return (
    <Modal visible={!!lockedInfo} animationType="fade" onRequestClose={handleLogout}>

      {/* Backdrop */}
      <View style={[styles.backdrop, { backgroundColor: isBan ? '#1a0000' : '#1a1200' }]} />

      {/* Content */}
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconBadge, { backgroundColor: accentColor + '22' }]}>
            <Ionicons name={isBan ? 'ban-outline' : 'pause-circle-outline'} size={28} color={accentColor} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: accentColor }]}>
            {isBan ? 'Account Permanently Banned' : 'Account Suspended'}
          </Text>

          <Text style={[styles.subtitle, { color: '#FFFFFF99' }]}>
            Your access has been revoked.
          </Text>

          {/* Reason card */}
          {lockedInfo?.reason && (
            <View style={[styles.reasonCard, { backgroundColor: '#FFFFFF0D' }]}>
              <Text style={[styles.reasonLabel, { color: '#FFFFFF66' }]}>Reason</Text>
              <Text style={[styles.reasonText, { color: '#FFFFFF' }]}>
                {lockedInfo.reason}
              </Text>
            </View>
          )}

          {/* Date card */}
          {(lockedInfo?.suspendedAt ?? lockedInfo?.bannedAt) && (
            <View style={[styles.dateCard, { backgroundColor: '#FFFFFF0D' }]}>
              <Text style={[styles.dateLabel, { color: '#FFFFFF66' }]}>
                {isBan ? 'Banned on' : 'Suspended on'}
              </Text>
              <Text style={[styles.dateText, { color: '#FFFFFFCC' }]}>
                {formatDate(lockedInfo?.suspendedAt ?? lockedInfo?.bannedAt)}
              </Text>
            </View>
          )}

          {/* Help text */}
          <Text style={[styles.helpText, { color: '#FFFFFF55' }]}>
            If you believe this was a mistake, contact support.
          </Text>

          {/* Logout button */}
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: accentColor }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing6,
  },
  iconBadge: {
    width: 80, height: 80,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing5,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 26, fontWeight: '900',
    textAlign: 'center',
    marginBottom: tokens.spacing2,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: tokens.spacing6,
  },
  reasonCard: {
    width: '100%', maxWidth: 360,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  reasonLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: tokens.spacing1 },
  reasonText: { fontSize: 14, lineHeight: 20 },
  dateCard: {
    width: '100%', maxWidth: 360,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  dateLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: tokens.spacing1 },
  dateText: { fontSize: 14 },
  helpText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: tokens.spacing2,
    marginBottom: tokens.spacing8,
    paddingHorizontal: tokens.spacing4,
  },
  logoutBtn: {
    width: '100%', maxWidth: 280,
    height: 52,
    borderRadius: tokens.radiusMd,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutBtnText: {
    fontSize: 16, fontWeight: '800', color: '#FFFFFF',
  },
});