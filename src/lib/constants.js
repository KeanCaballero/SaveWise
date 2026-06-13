import {
  MdWork, MdAccountBalanceWallet, MdLaptop, MdBusinessCenter, MdCardGiftcard, MdAttachMoney,
  MdRestaurant, MdDirectionsBus, MdReceiptLong, MdLocalGroceryStore, MdSchool,
  MdShoppingBag, MdMovie, MdMedicalServices, MdCategory,
} from 'react-icons/md'

export const INCOME_CATEGORIES = [
  { id: 'Salary', icon: MdWork, color: '#10b981' },
  { id: 'Allowance', icon: MdAccountBalanceWallet, color: '#22c55e' },
  { id: 'Freelance', icon: MdLaptop, color: '#14b8a6' },
  { id: 'Business', icon: MdBusinessCenter, color: '#0ea5e9' },
  { id: 'Gift', icon: MdCardGiftcard, color: '#a855f7' },
  { id: 'Other', icon: MdAttachMoney, color: '#64748b' },
]

export const EXPENSE_CATEGORIES = [
  { id: 'Food', icon: MdRestaurant, color: '#f59e0b' },
  { id: 'Transportation', icon: MdDirectionsBus, color: '#3b82f6' },
  { id: 'Bills', icon: MdReceiptLong, color: '#ef4444' },
  { id: 'Groceries', icon: MdLocalGroceryStore, color: '#84cc16' },
  { id: 'School', icon: MdSchool, color: '#8b5cf6' },
  { id: 'Shopping', icon: MdShoppingBag, color: '#ec4899' },
  { id: 'Entertainment', icon: MdMovie, color: '#06b6d4' },
  { id: 'Medical', icon: MdMedicalServices, color: '#f43f5e' },
  { id: 'Other', icon: MdCategory, color: '#64748b' },
]

export function categoryMeta(type, id) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find((c) => c.id === id) || list[list.length - 1]
}

export const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#64748b']

export const AVATAR_EMOJIS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄', '🐙', '🐢', '🐳', '🦉', '🐰']

export const AVATAR_COLORS = [
  { id: 'emerald', class: 'bg-emerald-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'violet', class: 'bg-violet-500' },
  { id: 'rose', class: 'bg-rose-500' },
  { id: 'amber', class: 'bg-amber-500' },
  { id: 'cyan', class: 'bg-cyan-500' },
  { id: 'pink', class: 'bg-pink-500' },
  { id: 'slate', class: 'bg-slate-500' },
]

export function avatarColorClass(id) {
  return (AVATAR_COLORS.find((c) => c.id === id) || AVATAR_COLORS[0]).class
}

export const BILL_TYPES = ['Electricity', 'Water', 'Internet', 'Rent', 'Phone', 'Other']
export const BILLING_CYCLES = ['weekly', 'monthly', 'yearly']
export const PRIORITIES = ['high', 'medium', 'low']
