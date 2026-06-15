const fs = require('fs');
const path = require('path');

const LANGS = ['as','bn','brx','doi','gu','hi','kn','ks','kok','mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur'];

// Load Hindi as reference
const hi = JSON.parse(fs.readFileSync('./mobile/public/locales/hi/common.json', 'utf8'));
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
collect(hi, '');
console.log('Hindi keys:', hiKeys.size);

function deepGet(obj, key) {
  let val = obj;
  for (const p of key.split('.')) {
    if (val && typeof val === 'object' && p in val) val = val[p];
    else return undefined;
  }
  return val;
}

function isEnglish(s) {
  return typeof s === 'string' && /^[A-Za-z]/.test(s) && s.length < 50;
}

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

const LANGS_DIR = './mobile/public/locales';

for (const lang of LANGS) {
  if (lang === 'hi') continue;
  const file = path.join(LANGS_DIR, lang, 'common.json');
  if (!fs.existsSync(file)) { console.log(lang + ': FILE MISSING'); continue; }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = [], englishOnly = [];
  for (const k of hiKeys) {
    const v = deepGet(d, k);
    if (v === undefined || v === null) { missing.push(k); continue; }
    if (ENGLISH_KEYS.has(k) && isEnglish(v)) englishOnly.push(k + '=' + JSON.stringify(v));
  }
  if (missing.length > 0) console.log('\n' + lang + ': ' + missing.length + ' MISSING');
  if (englishOnly.length > 0) {
    console.log('\n' + lang + ': ' + englishOnly.length + ' still in English:');
    englishOnly.slice(0, 20).forEach(e => console.log('  ' + e));
    if (englishOnly.length > 20) console.log('  ... +' + (englishOnly.length-20) + ' more');
  }
  if (missing.length === 0 && englishOnly.length === 0) {
    console.log(lang + ': ALL TRANSLATED');
  }
}