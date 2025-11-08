import React from 'react';
import { createRoot } from 'react-dom/client';
import { AccountBalancesWidget } from './AccountBalancesWidget';
import '../shared/styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<AccountBalancesWidget />);
}
