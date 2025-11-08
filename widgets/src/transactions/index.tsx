import React from 'react';
import { createRoot } from 'react-dom/client';
import { TransactionsWidget } from './TransactionsWidget';
import '../shared/styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<TransactionsWidget />);
}
