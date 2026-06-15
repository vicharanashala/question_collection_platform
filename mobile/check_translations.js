const fs = require('fs');
let content = fs.readFileSync('./mobile/src/i18n/resources.ts', 'utf8');

// Find the last valid }; before export default
const exportIdx = content.lastIndexOf('export default');
let before = content.substring(0, exportIdx);
let pos = before.length;
while (pos > 0) {
  pos = before.lastIndexOf('};', pos);
  if (pos === -1) break;
  if (/^\s*$/.test(before.substring(pos + 2, before.length))) break;
  pos = pos - 1;
}
const jsonStart = content.indexOf('{');
const jsonEnd = pos + 2;
const rawJson = content.substring(jsonStart, jsonEnd);

const d = JSON.parse(rawJson);
const langs = Object.keys(d).sort();

const hiKeys = new Set();
function collect(obj, prefix) {
  for (const k of Object.keys(obj)) {
    const full = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      collect(obj[k], full);
    } else {
      hiKeys.add(full);
    }
  }
}
collect(d.hi.common, '');
console.log('Hindi total flat keys:', hiKeys.size);
console.log('');

const ENGLISH_KEYS = new Set([
  "profile.location","profile.state","profile.district","profile.block",
  "profile.wallet","profile.questions","profile.memberSince","profile.myCrops",
  "profile.appearance","profile.editProfile","profile.signOut",
  "question.state","question.district","question.domain","question.season",
  "question.cropType","question.yourQuestion","question.attachMedia","question.photo",
  "question.selectState","question.selectDomain","question.selectSeason","question.enterCrop","question.enterQuestion",
  "question.submitQuestion","question.updateQuestion","question.editQuestion","question.askQuestion",
  "question.mediaHelp","question.tooltipAsk","question.tooltipEdit","question.mediaUploadHelp",
  "question.submitSuccess","question.updateSuccess","question.successBody","question.submitAnother",
  "myQuestions.title","myQuestions.loading","myQuestions.noQuestions","myQuestions.startAsking","myQuestions.loadError",
  "myQuestions.edit","myQuestions.editWindowClosedTitle",
  "submissions.title","submissions.loading","submissions.noSubmissions","submissions.noResults",
  "submissions.startAsking","submissions.loadError","submissions.editWindowClosed","submissions.filters",
  "submissions.reset","submissions.applyFilters","submissions.search","submissions.searchPlaceholder",
  "submissions.allStatus","submissions.allSeasons","submissions.allCategories","submissions.status",
  "submissions.season","submissions.category","submissions.questionDetails","submissions.noMedia",
  "submissions.crop","submissions.submitted","submissions.editWindow","submissions.editWindowRemaining",
  "submissions.rejectionReason","submissions.editQuestion","submissions.backToSubmissions",
  "submissions.approved","submissions.pending","submissions.rejected","submissions.duplicate",
  "editProfile.title","editProfile.subtitle","editProfile.personalInfo","editProfile.fullName",
  "editProfile.fullNamePlaceholder","editProfile.preferredLanguage","editProfile.locationSection",
  "editProfile.saveChanges","editProfile.cancel","editProfile.nameMinChars","editProfile.selectState",
  "editProfile.districtRequired","editProfile.saveSuccess","editProfile.saveFailed",
  "wallet.title","wallet.availableBalance","wallet.withdraw","wallet.minWithdrawal","wallet.requestWithdrawal",
  "wallet.amount","wallet.amountPlaceholder","wallet.payoutMethod","wallet.upiId","wallet.upiIdPlaceholder",
  "wallet.accountHolderName","wallet.accountHolderPlaceholder","wallet.accountNumber","wallet.accountNumberPlaceholder",
  "wallet.ifscCode","wallet.ifscCodePlaceholder","wallet.cancel","wallet.submitRequest",
  "wallet.transactionHistory","wallet.noTransactions","wallet.noTransactionsDesc",
  "wallet.minWithdrawalError","wallet.exceedBalance","wallet.enterUpiId","wallet.fillBankDetails",
  "wallet.success","wallet.failed","wallet.txTooltip","wallet.noTransactionsTitle",
  "wallet.upiTab","wallet.bankTab",
  "common.error","common.ok","common.loading",
]);

function deepGet(obj, key) {
  let val = obj;
  for (const part of key.split('.')) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      return undefined;
    }
  }
  return val;
}

function isEnglish(s) {
  return typeof s === 'string' && /^[A-Za-z]/.test(s);
}

for (const lang of langs) {
  if (lang === 'hi') continue;
  const ns = d[lang] && d[lang].common;
  if (!ns) {
    console.log(lang + ': NO common namespace');
    continue;
  }
  const missing = [];
  const englishOnly = [];
  for (const k of hiKeys) {
    const v = deepGet(ns, k);
    if (v === undefined || v === null) {
      missing.push(k);
    } else if (ENGLISH_KEYS.has(k) && isEnglish(v)) {
      englishOnly.push(k);
    }
  }
  if (missing.length > 0) {
    console.log(lang + ': ' + missing.length + ' MISSING keys');
  }
  if (englishOnly.length > 0) {
    console.log(lang + ': ' + englishOnly.length + ' still English: ' + englishOnly.slice(0, 15).join(', ') + (englishOnly.length > 15 ? ' ...' : ''));
  }
  if (missing.length === 0 && englishOnly.length === 0) {
    console.log(lang + ': ALL TRANSLATED');
  }
}