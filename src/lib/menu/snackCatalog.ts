import { type VoteOption } from './votingBlueprints';

export const SNACK_CATALOG: VoteOption[] = [
  // Fried Savory
  { id: 'S01', comboId: 'S01', label: 'Mirchi Bajji', emoji: '🌶️', items: ['Mirchi Bajji'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Mirchi'] },
  { id: 'S02', comboId: 'S02', label: 'Potato Bajji', emoji: '🥔', items: ['Potato Bajji'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Potato'] },
  { id: 'S03', comboId: 'S03', label: 'Banana Bajji', emoji: '🍌', items: ['Banana Bajji'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Banana'] },
  { id: 'S04', comboId: 'S04', label: 'Onion Pakoda', emoji: '🧅', items: ['Onion Pakoda'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Onion'] },
  { id: 'S05', comboId: 'S05', label: 'Masala Vada', emoji: '🧆', items: ['Masala Vada'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Vada'] },
  { id: 'S06', comboId: 'S06', label: 'Punugulu', emoji: '🧆', items: ['Punugulu'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Punugulu'] },
  { id: 'S07', comboId: 'S07', label: 'Cutlet', emoji: '🧆', items: ['Cutlet'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Cutlet'] },
  { id: 'S08', comboId: 'S08', label: 'Bread Pakoda', emoji: '🍞', items: ['Bread Pakoda'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Bread'] },
  { id: 'S10', comboId: 'S10', label: 'Samosa', emoji: '🥟', items: ['Samosa'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Samosa'] },
  { id: 'S11', comboId: 'S11', label: 'Onion Samosa', emoji: '🥟', items: ['Onion Samosa'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Onion'] },
  { id: 'S12', comboId: 'S12', label: 'Kachori', emoji: '🥯', items: ['Kachori'], category: 'snack', family: 'Fried Savory', subFamilies: ['Fried', 'Kachori'] },
  // Chaat
  { id: 'S13', comboId: 'S13', label: 'Corn Chaat', emoji: '🌽', items: ['Corn Chaat'], category: 'snack', family: 'Chaat', subFamilies: ['Chaat', 'Corn'] },
  { id: 'S14', comboId: 'S14', label: 'Rajma Chaat', emoji: '🫘', items: ['Rajma Chaat'], category: 'snack', family: 'Chaat', subFamilies: ['Chaat', 'Rajma'] },
  { id: 'S15', comboId: 'S15', label: 'Boiled Peanut Chaat', emoji: '🥜', items: ['Boiled Peanut Chaat'], category: 'snack', family: 'Chaat', subFamilies: ['Chaat', 'Peanut'] },
  { id: 'S16', comboId: 'S16', label: 'Masala Murmura', emoji: '🍿', items: ['Masala Murmura'], category: 'snack', family: 'Chaat', subFamilies: ['Chaat', 'Murmura'] },
  { id: 'S17', comboId: 'S17', label: 'Corn Masala', emoji: '🌽', items: ['Corn Masala'], category: 'snack', family: 'Chaat', subFamilies: ['Chaat', 'Corn'] },
  // Healthy
  { id: 'S18', comboId: 'S18', label: 'Cucumber Salad', emoji: '🥒', items: ['Cucumber Salad'], category: 'snack', family: 'Healthy', subFamilies: ['Healthy', 'Cucumber'] },
  { id: 'S19', comboId: 'S19', label: 'Sprouts Chaat', emoji: '🌱', items: ['Sprouts Chaat'], category: 'snack', family: 'Healthy', subFamilies: ['Healthy', 'Sprouts'] },
  { id: 'S20', comboId: 'S20', label: 'Fruit Bowl', emoji: '🍎', items: ['Fruit Bowl'], category: 'snack', family: 'Healthy', subFamilies: ['Healthy', 'Fruit'] },
  { id: 'S30', comboId: 'S30', label: 'Sweet Corn Cup', emoji: '🌽', items: ['Sweet Corn Cup'], category: 'snack', family: 'Healthy', subFamilies: ['Healthy', 'Corn'] },
  // Bakery
  { id: 'S09', comboId: 'S09', label: 'Veg Puff', emoji: '🥐', items: ['Veg Puff'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'Puff'] },
  { id: 'S21', comboId: 'S21', label: 'Cream Bun', emoji: '🥯', items: ['Cream Bun'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'CreamBun'] },
  { id: 'S22', comboId: 'S22', label: 'Sweet Bun', emoji: '🥯', items: ['Sweet Bun'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'SweetBun'] },
  { id: 'S23', comboId: 'S23', label: 'Bread Toast', emoji: '🍞', items: ['Bread Toast'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'BreadToast'] },
  { id: 'S24', comboId: 'S24', label: 'Biscuit Pack', emoji: '🍪', items: ['Biscuit Pack'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'Biscuit'] },
  { id: 'S25', comboId: 'S25', label: 'Dil Pasand', emoji: '🥧', items: ['Dil Pasand'], category: 'snack', family: 'Bakery', subFamilies: ['Bakery', 'DilPasand'] },
  // Fruit
  { id: 'S28', comboId: 'S28', label: 'Watermelon', emoji: '🍉', items: ['Watermelon'], category: 'snack', family: 'Fruit', subFamilies: ['Fruit', 'Watermelon'] },
  { id: 'S29', comboId: 'S29', label: 'Seasonal Fruit', emoji: '🍑', items: ['Seasonal Fruit'], category: 'snack', family: 'Fruit', subFamilies: ['Fruit', 'Seasonal'] },
  // Special
  { id: 'S26', comboId: 'S26', label: 'Noodles', emoji: '🍜', items: ['Noodles'], category: 'snack', family: 'Festival/Special', subFamilies: ['Special', 'Noodles'] },
  { id: 'S27', comboId: 'S27', label: 'Blue Punji', emoji: '🥤', items: ['Blue Punji'], category: 'snack', family: 'Festival/Special', subFamilies: ['Special', 'BluePunji'] },
  { id: 'S36', comboId: 'S36', label: 'Pani Puri', emoji: '🥟', items: ['Pani Puri'], category: 'snack', family: 'Festival/Special', subFamilies: ['Special', 'PaniPuri'] },
  // Sweet Traditional
  { id: 'S31', comboId: 'S31', label: 'Gulab Jamun', emoji: '🍡', items: ['Gulab Jamun'], category: 'snack', family: 'Sweet Traditional', subFamilies: ['Sweet', 'GulabJamun'] },
  { id: 'S32', comboId: 'S32', label: 'Kaja', emoji: '🥨', items: ['Kaja'], category: 'snack', family: 'Sweet Traditional', subFamilies: ['Sweet', 'Kaja'] },
  { id: 'S33', comboId: 'S33', label: 'Mysore Pak', emoji: '🧈', items: ['Mysore Pak'], category: 'snack', family: 'Sweet Traditional', subFamilies: ['Sweet', 'MysorePak'] },
  { id: 'S34', comboId: 'S34', label: 'Laddu', emoji: '🟠', items: ['Laddu'], category: 'snack', family: 'Sweet Traditional', subFamilies: ['Sweet', 'Laddu'] },
  { id: 'S35', comboId: 'S35', label: 'Jalebi', emoji: '🥨', items: ['Jalebi'], category: 'snack', family: 'Sweet Traditional', subFamilies: ['Sweet', 'Jalebi'] },
];
