import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpendingInsightsWidget } from './SpendingInsightsWidget';
import '../shared/styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SpendingInsightsWidget />);
}
