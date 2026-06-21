export interface CategoryLimits {
  [categoryName: string]: number; // Limit amount, 0 means no limit
}

export interface Subcategory {
  name: string;
  limit: number;
}

export interface BudgetSection {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

export interface Budget {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any; // Firestore serverTimestamp
  updatedAt: any;
  categories: CategoryLimits;
  members: string[]; // List of user UIDs
  sections?: BudgetSection[]; // Hierarchical sections and subcategories for custom groups
}

export interface Transaction {
  id: string;
  budgetId: string;
  amount: number;
  category: string;
  description: string;
  type: 'expense' | 'income';
  date: string; // YYYY-MM-DD
  createdAt: any; // Firestore serverTimestamp
  createdBy: string;
  createdByName: string; // Display name
}

export interface Reminder {
  id: string;
  budgetId: string;
  title: string;
  amount: number;
  category: string;
  dueDay: number; // 1 to 31
  lastPaidMonth?: string; // YYYY-MM (indicates if paid in this month)
  createdAt: any;
  createdBy: string;
}

export interface UserState {
  uid: string;
  displayName: string;
  email: string | null;
}

export function getFriendlySections(budget: Budget): BudgetSection[] {
  if (budget.sections && budget.sections.length > 0) {
    return budget.sections;
  }
  
  // Backward compatibility migration mapper
  const categoriesMap = budget.categories || {};
  const sections: BudgetSection[] = [
    {
      id: 'sec-default-dining',
      name: 'Питание',
      subcategories: []
    },
    {
      id: 'sec-default-housing',
      name: 'Дом и жилье',
      subcategories: []
    },
    {
      id: 'sec-default-transport',
      name: 'Транспорт',
      subcategories: []
    },
    {
      id: 'sec-default-other',
      name: 'Другое',
      subcategories: []
    }
  ];

  Object.entries(categoriesMap).forEach(([name, limitVal]) => {
    const limit = Number(limitVal) || 0;
    const lower = name.toLowerCase();
    
    if (lower.includes('продукт') || lower.includes('кафе') || lower.includes('ресторан') || lower.includes('еда') || lower.includes('питание')) {
      sections[0].subcategories.push({ name, limit });
    } else if (lower.includes('жкх') || lower.includes('аренд') || lower.includes('дом') || lower.includes('квартир') || lower.includes('коммунал')) {
      sections[1].subcategories.push({ name, limit });
    } else if (lower.includes('транспорт') || lower.includes('машин') || lower.includes('авто') || lower.includes('бензин') || lower.includes('такси')) {
      sections[2].subcategories.push({ name, limit });
    } else {
      sections[3].subcategories.push({ name, limit });
    }
  });

  return sections.filter(s => s.subcategories.length > 0 || s.id === 'sec-default-other');
}
