import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/main.scss';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
