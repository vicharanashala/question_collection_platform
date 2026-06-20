/**
 * Seed 100 dummy farmer accounts with real Indian names.
 * Run with: npx ts-node src/database/seeds/seed-100-farmers.ts
 */
import { AppDataSource } from '../../config/typeorm.config';
import { User, Wallet } from '../entities';
import { UserRole, UserCategory } from '../../common/enums';

const INDIAN_FIRST_NAMES = [
  'Ramesh', 'Sunita', 'Ganesh', 'Lakshmi', 'Vijay', 'Meena', 'Prakash', 'Kavita',
  'Raju', 'Fatima', 'Anil', 'Sita', 'Mohan', 'Geeta', 'Bhushan', 'Kamala',
  'Shyam', 'Radha', 'Suresh', 'Asha', 'Ravi', 'Neeta', 'Anita', 'Vikram',
  'Pooja', 'Arun', 'Deepa', 'Naresh', 'Kiran', 'Usha', 'Mahesh', 'Rekha',
  'Vijay', 'Shobha', 'Rajesh', 'Kavita', 'Dilip', 'Mona', 'Gopal', 'Asha',
  'Om', 'Mira', 'Pravin', 'Sushma', 'Vilas', 'Sunanda', 'Rajendra', 'Nirmala',
  'Baban', 'Sukanya', 'Santosh', 'Manisha', 'Basavaraj', 'Lata', 'Shrikant', 'Vidya',
  'Hemant', 'Kunda', 'Uttam', 'Madhuri', 'Shivaji', 'Sangita', 'Tukaram', 'Jayshree',
  'Pandit', 'Durga', 'Balaji', 'Mayuri', 'Satish', 'Shweta', 'Vasant', 'Kavita',
  'Govind', 'Manda', 'Pramod', 'Urmila', 'Dinesh', 'Anju', 'Shankar', 'Anupama',
  'Raghunath', 'Vasudha', 'Yogesh', 'Sangharsh', 'Pravin', 'Shilpa', 'Vikram', 'Mariyam',
];

const INDIAN_LAST_NAMES = [
  'Patel', 'Yadav', 'Singh', 'Reddy', 'Kumar', 'Sharma', 'Gupta', 'Jadhav',
  'Choudhary', 'Mahato', 'Sahoo', 'Mandal', 'Hasan', 'Shaikh', 'Mistry', 'Devi',
  'Naik', 'Rao', 'Pillai', 'Iyer', 'Nair', 'Gouda', 'Raut', 'Mohanty',
  'Tripathy', 'Panda', 'Sarangi', 'Barik', ' Das', 'Khatoon', 'Ansari', 'Khan',
  'Chandra', 'Verma', 'Yadav', 'Pal', 'Soni', 'Tiwari', 'Dubey', 'Dwivedi',
  'Agarwal', 'Aggarwal', 'Mehta', 'Shah', 'Choksi', 'Joshi', 'Prajapati', 'Thakur',
  'Chauhan', 'Solanki', 'Parmar', 'Vasava', 'Gamit', 'Bharwad', 'Rathod', 'Zala',
  'Gohil', 'Dodia', 'Vaghela', 'Chudasama', 'Khant', 'Maa', 'Baman', 'Pasi',
];

const STATES_DISTRICTS: Array<{ state: string; districts: string[] }> = [
  { state: 'Maharashtra', districts: ['Pune', 'Nagpur', 'Nashik', 'Mumbai', 'Aurangabad', 'Solapur', 'Kolhapur', 'Latur'] },
  { state: 'Uttar Pradesh', districts: ['Lucknow', 'Varanasi', 'Agra', 'Kanpur', 'Allahabad', 'Bareilly', 'Meerut', 'Aligarh'] },
  { state: 'Bihar', districts: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Bihar Sharif', 'Arrah'] },
  { state: 'Rajasthan', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar', 'Bharatpur'] },
  { state: 'Gujarat', districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar'] },
  { state: 'West Bengal', districts: ['Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda', 'Kharagpur'] },
  { state: 'Karnataka', districts: ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Gulbarga', 'Davanagere', 'Shimoga'] },
  { state: 'Tamil Nadu', districts: ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli', 'Vellore', 'Erode'] },
  { state: 'Andhra Pradesh', districts: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Kadapa', 'Rajahmundry', 'Tirupati'] },
  { state: 'Telangana', districts: ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', ' Karimnagar', 'Ramagundam', 'Secunderabad', 'Mahbubnagar'] },
  { state: 'Madhya Pradesh', districts: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna'] },
  { state: 'Punjab', districts: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Moga'] },
  { state: 'Haryana', districts: ['Gurgaon', 'Faridabad', 'Hisar', 'Rohtak', 'Karnal', 'Panipat', 'Ambala', 'Sonipat'] },
  { state: 'Odisha', districts: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Balasore', 'Baripada', 'Balangir'] },
  { state: 'Chhattisgarh', districts: ['Raipur', 'Bhilai', 'Durg', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Ambikapur', 'Jagdalpur'] },
  { state: 'Jharkhand', districts: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Ramgarh', 'Giridih'] },
  { state: 'Assam', districts: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Bongaigaon', 'Kamrup', 'Sivasagar'] },
  { state: 'Kerala', districts: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Kannur', 'Alappuzha'] },
];

const CROPS = [
  'Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Soybean', 'Maize', 'Groundnut',
  'Mustard', 'Barley', 'Jowar', 'Bajra', 'Turmeric', 'Ginger', 'Onion', 'Potato',
];

const CATEGORIES = [
  UserCategory.FARMER,
  UserCategory.FPO,
  UserCategory.STUDENT,
  UserCategory.VOLUNTEER,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mobile(n: number) {
  return String(n).padStart(10, '0');
}

async function main() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const walletRepo = AppDataSource.getRepository(Wallet);

  // Check for existing seed users (mobile starts with 91)
  const existing = await userRepo.createQueryBuilder('u')
    .where('u.mobile_number LIKE :prefix', { prefix: '91%' })
    .getMany();

  if (existing.length > 0) {
    const ids = existing.map(u => u.id);
    await walletRepo.delete({ userId: undefined });
    await userRepo.delete(ids);
    console.log(`Cleared ${existing.length} existing seed users`);
  }

  console.log('Creating 100 farmer accounts...\n');

  const shuffledFirst = shuffle(INDIAN_FIRST_NAMES);
  const shuffledLast = shuffle(INDIAN_LAST_NAMES);

  for (let i = 0; i < 100; i++) {
    const firstName = shuffledFirst[i % shuffledFirst.length];
    const lastName = shuffle(INDIAN_LAST_NAMES)[0];
    const name = `${firstName} ${lastName}`;
    const num = 9100000100 + i;
    const stateDist = pick(STATES_DISTRICTS);
    const district = pick(stateDist.districts);
    const crop = pick(CROPS);
    const category = Math.random() < 0.75 ? UserCategory.FARMER : pick(CATEGORIES.filter(c => c !== UserCategory.FARMER));

    const farmSize = (1 + Math.random() * 10).toFixed(2);

    const user = userRepo.create({
      name,
      mobileNumber: mobile(num),
      role: UserRole.USER,
      category,
      state: stateDist.state,
      district,
      block: `Block-${(i % 5) + 1}`,
      languagePreference: 'en',
      consentGiven: true,
      consentTimestamp: new Date(),
      profileData: {
        farmSize: parseFloat(farmSize),
        cropType: crop,
        season: i % 2 === 0 ? 'Kharif' : 'Rabi',
      },
    });

    const saved = await userRepo.save(user);

    const wallet = walletRepo.create({ userId: saved.id, balance: 0 });
    await walletRepo.save(wallet);

    if ((i + 1) % 20 === 0) {
      console.log(`  Created ${i + 1}/100...`);
    }
  }

  console.log('\nDone — 100 farmer accounts created.');
  await AppDataSource.destroy();
}

main().catch((e: unknown) => { console.error(e); process.exit(1); });