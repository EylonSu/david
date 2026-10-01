import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/varela-round/hebrew-400.css';
import '@fontsource/varela-round/latin-400.css';
import './styles/global.css';
import { App } from './App';
import { requestPersistentStorage } from './db';
import { startSync } from './sync/engine';

void requestPersistentStorage();
startSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
