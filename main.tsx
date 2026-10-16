import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Tipografías e iconos alojados en la propia app (funcionan sin internet; no dependen de Google Fonts).
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/comfortaa/latin-700.css';
import '@fontsource-variable/material-symbols-outlined/fill.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
