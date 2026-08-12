const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/modules/admin/admin.service.ts');
let src = fs.readFileSync(file, 'utf8');

// ── 1. configRepo.update({ key: ... }, data) → updateMany ──────────────────
src = src.replace(
  /await this\.configRepo\.update\(\{ key: dto\.key \}, \{/g,
  'await this.configRepo.updateMany({ key: dto.key }, {'
);

// ── 2. transactionRepo.update(filter, data) → updateMany ───────────────────
// Match all occurrences (filter is a complex object literal, data is an object)
src = src.replace(
  /await this\.transactionRepo\.update\(\s*\{[^}]+\},/g,
  (match) => match.replace('.update(', '.updateMany(')
);

// ── 3. withdrawalRepo.update(stringId, data) → keep .update(id, data) OK ──
// No change needed for single-id update signature

// ── 4. Fix all save(create(...)) patterns where result is used ─────────────
// notificationRepo.save(notificationRepo.create({...})) — await both
src = src.replace(
  /await this\.notificationRepo\.save\(\s*this\.notificationRepo\.create\(\{/g,
  'await this.notificationRepo.save(await this.notificationRepo.create({'
);

// paymentLogRepo.save(paymentLogRepo.create({...})) — await both
src = src.replace(
  /await this\.paymentLogRepo\.save\(\s*this\.paymentLogRepo\.create\(\{/g,
  'await this.paymentLogRepo.save(await this.paymentLogRepo.create({'
);

// ── 5. Fix userRepo.create() → await ───────────────────────────────────────
// const user = this.userRepo.create({...})
// then later await this.userRepo.save(user);
// → const user = await this.userRepo.create({...})
src = src.replace(
  /const user = this\.userRepo\.create\(\{/g,
  'const user = await this.userRepo.create({'
);

// ── 6. Fix other similar patterns: .save(.create({...})) for entities ──────
// Generic pattern: await this.{repo}.save(this.{repo}.create({...}))
src = src.replace(
  /await this\.(\w+)\.save\(\s*this\.\1\.create\(\{/g,
  'await this.$1.save(await this.$1.create({'
);

fs.writeFileSync(file, src);
console.log('Done');