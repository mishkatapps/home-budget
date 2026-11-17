import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initPrefs } from './lib/prefs';
import { initTheme } from './lib/theme';
import { startI18n } from './lib/i18n';

startI18n();
initTheme();
initPrefs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
