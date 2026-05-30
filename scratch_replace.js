import fs from 'fs';
import path from 'path';

const dir = 'src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const replacements = [
  // text-[#111827] -> text-[#111827] dark:text-gray-100
  { pattern: /text-\[#111827\]/g, replacement: 'text-[#111827] dark:text-gray-100' },
  // bg-[#111827] -> bg-[#111827] dark:bg-gray-100
  { pattern: /bg-\[#111827\]/g, replacement: 'bg-[#111827] dark:bg-gray-100' },
  // border-[#111827] -> border-[#111827] dark:border-gray-100
  { pattern: /border-\[#111827\]/g, replacement: 'border-[#111827] dark:border-gray-100' },
  // bg-white -> bg-white dark:bg-gray-800
  { pattern: /bg-white(?! dark:)/g, replacement: 'bg-white dark:bg-gray-800' },
  // border-gray-200 -> border-gray-200 dark:border-gray-700
  { pattern: /border-gray-200(?! dark:)/g, replacement: 'border-gray-200 dark:border-gray-700' },
  // border-gray-150 -> border-gray-150 dark:border-gray-700 (if any)
  { pattern: /border-gray-150(?! dark:)/g, replacement: 'border-gray-150 dark:border-gray-700' },
  // bg-gray-50 -> bg-gray-50 dark:bg-gray-900/50
  { pattern: /bg-gray-50(?! dark:)/g, replacement: 'bg-gray-50 dark:bg-gray-900/50' },
  // bg-gray-100 -> bg-gray-100 dark:bg-gray-800
  { pattern: /bg-gray-100(?! dark:)/g, replacement: 'bg-gray-100 dark:bg-gray-800' },
  // text-gray-500 -> text-gray-500 dark:text-gray-400
  { pattern: /text-gray-500(?! dark:)/g, replacement: 'text-gray-500 dark:text-gray-400' },
  // text-white -> text-white dark:text-gray-900 (only when used with bg-[#111827] usually)
  { pattern: /text-white/g, replacement: 'text-white dark:text-gray-900' }
];

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  for (const { pattern, replacement } of replacements) {
    content = content.replace(pattern, replacement);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
