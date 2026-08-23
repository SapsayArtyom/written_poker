import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.js';
import './styles/global.css';

// HashRouter, а не BrowserRouter: на GitHub Pages нет серверных редиректов
// на index.html, и обычные пути ломались бы при перезагрузке страницы.
const root = document.getElementById('root');
if (!root) throw new Error('Не найден #root');

createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
