/**
 * Shared Terms of Service / Privacy Policy copy for the public web app.
 * Single source of truth for both the registration consent gate
 * (`PublicRegisterPage`) and the standalone `/home/terms` and
 * `/home/privacy` pages linked from the Profile screen — keeps the
 * text the two surfaces show in lockstep.
 */
const SUPPORT_EMAIL = (import.meta as any).env?.VITE_SUPPORT_EMAIL as string | undefined

export interface LegalSection {
  id: string
  title: string
  body: string
}

// Mirrors mobile/src/screens/Auth/TermsScreen.tsx (11 sections).
export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: '1',
    title: 'Acceptance of Terms',
    body: 'By accessing or using the AnnaDatha platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.',
  },
  {
    id: '2',
    title: 'Purpose of the Platform',
    body: 'AnnaDatha is an agricultural knowledge platform that allows users to submit questions, share expertise, and receive answers related to farming, crops, and agricultural practices.',
  },
  {
    id: '3',
    title: 'User Accounts',
    body: 'You agree to provide accurate and complete information during registration. You are solely responsible for maintaining the confidentiality of your account and for all activities under your account.',
  },
  {
    id: '4',
    title: 'Content You Submit',
    body: 'Questions and content submitted by you will be used for agricultural research, AI model training, and policy planning purposes. All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion.',
  },
  {
    id: '5',
    title: 'Moderation',
    body: 'The platform reserves the right to moderate, edit, approve, or reject any submitted content at any time without prior notice. We may suspend or terminate your access if you violate these terms.',
  },
  {
    id: '6',
    title: 'Rewards and Incentives',
    body: 'Rewards and incentives are subject to platform policy and may be changed or withdrawn at any time without prior notice. All rewards are subject to verification and approval of submitted content.',
  },
  {
    id: '7',
    title: 'Privacy',
    body: 'Your mobile number and registration details will be stored securely and used solely for platform authentication and agricultural knowledge services. For full details, please refer to our Privacy Policy.',
  },
  {
    id: '8',
    title: 'Account Deletion',
    body: 'You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.',
  },
  {
    id: '9',
    title: 'Limitation of Liability',
    body: 'The platform is provided "as is." We do not guarantee the accuracy, completeness, or usefulness of any information on the platform. You are solely responsible for the accuracy of information submitted through your account.',
  },
  {
    id: '10',
    title: 'Changes to Terms',
    body: 'We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
  },
  {
    id: '11',
    title: 'Contact',
    body: SUPPORT_EMAIL
      ? `For questions about these Terms of Service, please contact our support team at ${SUPPORT_EMAIL}.`
      : 'For questions about these Terms of Service, please contact our support team.',
  },
]

// Inlined summary of PRIVACY_POLICY.md (12 sections).
export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: '1',
    title: 'Introduction',
    body: 'Annam.Ai ("we," "us," or "our") operates the AnnaDatha platform. We are committed to protecting your privacy and ensuring that your personal data is handled responsibly. This Privacy Policy explains how we collect, use, store, disclose, and protect information about you when you use the AnnaDatha Platform.',
  },
  {
    id: '2',
    title: 'Information We Collect',
    body: 'We collect your mobile number, name, category, location (state, district, block, village), KVK affiliation, language preference, optional profile photo, and the questions, answers and comments you submit. We also collect device information, app usage data, IP address, and login timestamps automatically.',
  },
  {
    id: '3',
    title: 'How We Use Your Information',
    body: 'We use your information to create and manage your account, authenticate you via OTP, personalise your experience, deliver relevant content, enable direct messaging, maintain security, detect fraud, send service notifications, respond to support requests, improve the Platform, train AI models from your audio submissions, and comply with legal obligations.',
  },
  {
    id: '4',
    title: 'Data Sharing and Disclosure',
    body: 'We do not sell your personal data. We share data only with trusted service providers (cloud hosting, SMS gateway, analytics), within community features (public posts are visible to other users, but your mobile number is not), via direct messages (visible only to sender and recipient), when required by law, or in aggregated form for research and policy.',
  },
  {
    id: '5',
    title: 'Data Retention',
    body: 'Personal data is stored on secure servers operated by Annam.Ai or our cloud providers. Account data is retained while your account is active and for up to 3 years after deletion. Audit logs are retained for at least 1 year. Posted content may be retained in anonymised form after account deletion. When no longer needed, we securely delete or anonymise the data.',
  },
  {
    id: '6',
    title: 'Data Security',
    body: 'We use encrypted transmission (HTTPS), password hashing (bcrypt), role-based access controls, and regular security reviews. No method of transmission over the internet is 100% secure, but we strive to protect your data.',
  },
  {
    id: '7',
    title: 'Your Rights',
    body: 'You have the right to access, correct, delete, withdraw consent for, and request a portable copy of your personal data. You may also raise a grievance — we aim to respond within 30 days. To exercise any of these rights, contact us at the email below.',
  },
  {
    id: '8',
    title: 'Cookies and Tracking',
    body: 'The AnnaDatha app does not use browser cookies. We may use equivalent local storage and session-management technologies for keeping you signed in, remembering your language and display preferences, and basic app analytics.',
  },
  {
    id: '9',
    title: "Children's Privacy",
    body: 'The Platform is not intended for users under 18 years of age. We do not knowingly collect personal data from minors. If we become aware that we have inadvertently collected data from a minor, we will delete it promptly.',
  },
  {
    id: '10',
    title: 'Third-Party Links',
    body: 'The Platform may contain links to external websites or services not operated by us. We are not responsible for the privacy practices of third-party sites. We encourage you to review the privacy policies of any third-party sites you visit.',
  },
  {
    id: '11',
    title: 'Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. Material changes will be communicated by posting the updated policy within the Platform and updating the "Effective Date." We encourage you to review this policy periodically.',
  },
  {
    id: '12',
    title: 'Contact Us',
    body: SUPPORT_EMAIL
      ? `For privacy-related questions, data access requests, or grievances, please contact us at ${SUPPORT_EMAIL}. We aim to respond to all legitimate requests within 30 days.`
      : 'For privacy-related questions, data access requests, or grievances, please contact us via the AnnaDatha App. We aim to respond to all legitimate requests within 30 days.',
  },
]
