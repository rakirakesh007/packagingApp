export interface CategoryDef {
  name: string;
  hindi_name: string;
}

export const CATEGORIES: CategoryDef[] = [
  { name: 'Powder Spices',     hindi_name: 'पाउडर मसाले' },
  { name: 'Whole Spices',      hindi_name: 'साबुत मसाले' },
  { name: 'Mix Masala Whole',  hindi_name: 'मिक्स मसाला (साबुत)' },
  { name: 'Mix Masala Powder', hindi_name: 'मिक्स मसाला (पाउडर)' },
];
