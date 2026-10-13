import { createContext, useContext } from 'react';

export const NavigationContext = createContext(null);

export function useNavigationLayout() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('Menu Manager must be used within AppShell.');
  return value;
}
