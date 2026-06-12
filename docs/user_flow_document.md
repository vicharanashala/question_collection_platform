# User Flow Document

## Project
Agriculture Knowledge Collection Platform

---

# 1. Authentication Flow

## 1.1 Registration Flow

```
[Start] --> [Enter Mobile Number] --> [Request OTP]
                                           |
                              [OTP Sent Successfully?]
                                    /      \
                                   No      Yes
                                    \      /
                                     v     v
                              [Retry OTP]  [Enter OTP]
                                    ^         |
                                    |         v
                              [Invalid OTP?] [OTP Valid?]
                                    /      \
                                   No      Yes
                                    \      /
                                     v     v
                               [Resend]  [Consent Screen]
                                              |
                                              v
                                    [Accept Privacy Policy]
                                              |
                                              v
                                    [Select User Category]
                                   /    \    \      \
                                  v      v    v      v
                              Farmer  FPO  Student Volunteer/NGO
                                  \    /    \      /
                                   v    v    v    v
                              [Category-Specific Profile Form]
                                   /    \    \      \
                                  v      v    v      v
                            Name,     Name,   Name,    Name,
                            Mobile,   Mobile, Mobile,  Mobile,
                            State,    State,  State,   State,
                            District, District, District, District,
                            Crop,     Crop,   Course,  Org Name,
                            Farm Size University  Role
                                              |
                                              v
                                    [Language Selection]
                                              |
                                              v
                                    [Submit Registration]
                                              |
                                              v
                              [Manual Verification Queue]
                                     /         \
                                   Pending    Verified
                                     |           |
                                     v           v
                              [Retry Later]  [Welcome Screen]
```

### Fields by User Category

| Field | Farmer | FPO Member | Student | Volunteer/NGO |
|---|---|---|---|---|
| Name | Required | Required | Required | Required |
| Mobile Number | Required | Required | Required | Required |
| State | Required | Required | Required | Required |
| District | Required | Required | Required | Required |
| Crop Details | Required | Required | - | - |
| Farm Size | Required | - | - | - |
| Crop Type | Required | - | - | - |
| Course Name | - | - | Required | - |
| University Name | - | - | Required | - |
| Organization Name | - | - | - | Required |
| Role | - | - | - | Required |

## 1.2 Login Flow

```
[App Launch] --> [Check Existing Session]
                         |
              [Session Valid?] --No--> [Login Screen]
                    |                        |
                   Yes                       v
                    |              [Enter Mobile Number]
                    |                        |
                    v              [Request OTP]
                    |                        |
                    v              [Enter OTP]
                    |                        |
                    v              [OTP Valid?]
                    |                        |
                    v                   [Yes]
                    |                        |
                    v                        v
            [Main Dashboard] <-- [Login Success]
```

---

# 2. Question Submission Flow

## 2.1 Submission Entry

```
[Dashboard] --> [Tap "Ask Question"] --> [Select Language]
 (22 languages: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi,
  Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri,
  Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi,
  Tamil, Telugu, Urdu)
                                              |
                                              v
                                    [Select Agriculture Domain]
                                   /    \    \      \
                                  v      v    v      v
                           Crop     Spray  Irrigation  Fertilizer
                           Protection                       ...
                                              |
                                              v
                                    [Select Season]
                                   /    \    \      \
                                  v      v    v      v
                             Kharif  Rabi  Zaid  Year-round
                                              |
                                              v
                                    [Select Crop Type]
                                              |
                                              v
                                    [Enter Question Text]
                                              |
                                              v
                              [Attach Media (Optional)]
                                   /    \    \      \
                                  v      v    v      v
                                 None   Image  Video  Audio
                                  \    /    \      /
                                   v    v    v    v
                              [Video: Validate Duration <= 10s, Size <= 10MB]
                                              |
                                              v
                              [Submit Question]
```

## 2.2 On-Device AI Validation

```
[Submit Question] --> [On-Device Duplicate Check]
                               |
                  [Exact or Semantic Duplicate Found? (Threshold: 0.9)]
                        /                \
                       Yes                No
                        |                  |
                        v                  v
        [Show Error: Duplicate +         [On-Device Agriculture Relevance Check]
         Send In-App Notification]                        |
                                              [Agriculture Relevant? (Confidence >= 90%)]
                                                    /                \
                                                   Yes                No
                                                    |                  |
                                                    v                  v
                                      [Question Queued for    [Show Error: Not
                                       Server-Side Review]     Agriculture Related]
```

## 2.3 Edit Before Submission

```
[Submit Question] --> [30-Second Edit Window Opens]
                                  |
                   [User Edits Within 30 Seconds?]
                         /                \
                        Yes                No
                         |                  |
                         v                  v
                  [Update Question]  [Edit Window Closes]
                         |                  |
                         v                  v
                  [On-Device Validation]    |
                         |                  |
                         v                  v
                  [Question Queued] <-------+
```

## 2.4 Post-Submission Status

```
[Question Submitted] --> [Pending AI + Human Review]
                                    |
                        [Server-Side Duplicate Check]
                                    |
                       [Duplicate Detected?]
                           /         \
                         Yes           No
                          |             |
                          v             v
                    [Rejected]   [AI Confidence Score >= 90%?]
                    (No Reward)         /         \
                                     Below 90%     Yes
                                         |           |
                                         v           v
                                  [Human Review]  [Approved]
                                         |         (Reward Credited)
                                  [Approved/     [Added to
                                   Rejected]      Knowledge Repo]
```

---

# 3. Reward and Wallet Flow

## 3.1 Reward Credit

```
[Question Approved] --> [Calculate Tier Based on Total Approved Questions]
                                      |
                        [Tier 1 (1-25)]  [Tier 2 (26-250)]  [Tier 3 (251-500)]
                           @ Rs.1/q           @ Rs.5/q          @ Rs.10/q
                              |                  |                 |
                              v                  v                 v
                         [Credit Wallet]  [Credit Wallet]  [Credit Wallet]
                                                |
                                                v
                                    [Show Notification to User]
```

## 3.2 Wallet and Withdrawal

```
[Wallet Screen] --> [View Balance]
                        |
                        v
              [View Transaction History]
                        |
                        v
              [Request Withdrawal]
                        |
          [Balance >= Rs.50 Minimum?]
               /                \
             Yes                 No
              |                   |
              v                   v
      [Select Payout Method] [Show Error: Below Minimum]
              |
       /      \      \
      v        v      v
    UPI   Bank Transfer  Internal Wallet
      |        |              |
      v        v              v
  [Enter UPI] [Enter Bank   [Balance stays
   Address]    Details]       in wallet]
      |         |              |
      v         v              v
  [Submit]  [Submit]      [Transaction Complete]
                |
                v
         [Withdrawal Processed]
         [Transaction Logged]
```

---

# 4. Admin Flows

## 4.1 User Management

```
[Admin Dashboard] --> [User Management]
                            |
                            v
                   [View All Users]
                            |
                            v
                  [Filter: State / Category / Status]
                            |
                            v
                  [Select User Action]
             /         \           \         \
            v           v           v         v
      View Profile  Suspend User  Ban User  Configure State Limit
            |             |            |              |
            v             v            v              v
      [User Details] [Suspension   [Permanent     [Set Max Users
                      Period: X]     Ban]           Per State]
```

## 4.2 Question Review

```
[Review Queue] --> [View Pending Questions]
                          |
                          v
               [AI Confidence Score < 90%]
                          |
                          v
                  [Human Review Task]
                          |
               /          \           \
              v            v           v
         [Approve]   [Reject]    [Flag for
                               Additional Info]
              |            |           |
              v            v           v
        [Reward Credited] [No Reward] [Notify User]
```

## 4.3 Fraud Review

```
[Flagged Submission] --> [Review Submission]
                               |
                               v
                      [Determine Violation Type]
                    /           \               \
                   v             v               v
            Duplicate      Spam            Abuse
               |              |               |
        [No Reward]    [Warning on 1st]  [Progressive
               |        Reject on 2nd]   Penalty Model]
               |              |               |
               v              v               v
    [Log Incident +    [Issue Warning]  [Warning -->
     Send In-App         or             Temporary
     Notification]      Reject          Suspension]
```

---

# 5. Analytics and Reporting Flow

```
[Admin Dashboard] --> [Select Dashboard]
                              |
        /    \    \    \    \    \    \
       v      v    v    v    v    v    v
    Daily  State Crop  Reward Payout User    Domain
    Volume Wise  Wise  Analytics Engagement Category
       |      |    |    |       |       Analytics
       v      v    v    v       v           |
  [Graph]  [Map] [Pie][Table] [Graph]   [Graph]
                              |
                              v
                       [Export Data]
                        /         \
                       v           v
                    CSV          Excel
```

---

# Version
1.0

---

# Last Updated
2026-06-11