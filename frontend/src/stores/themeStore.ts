import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
}

// Get initial theme from localStorage or default to light
const savedTheme = localStorage.getItem('theme');
const initialIsDark = savedTheme === 'dark';

// Apply initial theme immediately
if (initialIsDark) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: initialIsDark,
  toggleTheme: () => {
    const currentIsDark = get().isDark;
    const newIsDark = !currentIsDark;
    
    console.log('Toggle theme:', { currentIsDark, newIsDark }); // Debug log
    
    // Force remove both classes first
    document.documentElement.classList.remove('dark', 'light');
    
    // Force a reflow
    void document.documentElement.offsetHeight;
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
    
    // Log the actual classes on the HTML element
    console.log('HTML classes:', document.documentElement.className);
    
    set({ isDark: newIsDark });
  },
}));
