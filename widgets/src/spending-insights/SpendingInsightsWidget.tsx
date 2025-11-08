import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, TrendingUp } from 'lucide-react';
import { useWidgetProps } from '../shared/use-widget-props';

interface Category {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

interface SpendingInsightsData {
  categories: Category[];
  totalSpending: number;
  dateRange: {
    start: string;
    end: string;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // green
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
];

function CategoryBar({ category, index, total }: { category: Category; index: number; total: number }) {
  const percentage = (category.amount / total) * 100;
  const color = COLORS[index % COLORS.length];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-2"
    >
      <div className="flex justify-between items-baseline">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-gray-900 capitalize">
            {category.name.replace('_', ' ')}
          </span>
          <span className="text-sm text-gray-500">
            ({category.count} transaction{category.count !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-gray-900">
            {formatCurrency(category.amount)}
          </span>
          <span className="text-sm text-gray-500 ml-2">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: index * 0.1 + 0.2, duration: 0.6 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
}

function SimplePieChart({ categories, total }: { categories: Category[]; total: number }) {
  let currentAngle = -90; // Start from top

  return (
    <div className="relative w-64 h-64 mx-auto">
      <svg viewBox="0 0 100 100" className="transform -rotate-90">
        {categories.map((category, index) => {
          const percentage = (category.amount / total) * 100;
          const angle = (percentage / 100) * 360;
          const endAngle = currentAngle + angle;

          // Calculate arc path
          const startX = 50 + 40 * Math.cos((currentAngle * Math.PI) / 180);
          const startY = 50 + 40 * Math.sin((currentAngle * Math.PI) / 180);
          const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
          const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

          const largeArc = angle > 180 ? 1 : 0;

          const path = `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`;

          const color = COLORS[index % COLORS.length];
          const result = (
            <motion.path
              key={category.name}
              d={path}
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            />
          );

          currentAngle = endAngle;
          return result;
        })}
        {/* Center hole for donut effect */}
        <circle cx="50" cy="50" r="25" fill="rgb(249, 250, 251)" />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-sm text-gray-500">Total Spent</div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(total)}
        </div>
      </div>
    </div>
  );
}

export function SpendingInsightsWidget() {
  const data = useWidgetProps<SpendingInsightsData>({
    categories: [],
    totalSpending: 0,
    dateRange: {
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
  });

  const { categories, totalSpending, dateRange } = data;
  const topCategories = categories.slice(0, 8);

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Spending Insights
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              {new Date(dateRange.start).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span>—</span>
            <span>
              {new Date(dateRange.end).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Pie Chart */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Category Breakdown
              </h2>
              <SimplePieChart categories={topCategories} total={totalSpending} />
            </div>

            {/* Category Bars */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Categories
              </h2>
              <div className="space-y-4">
                {topCategories.map((category, index) => (
                  <CategoryBar
                    key={category.name}
                    category={category}
                    index={index}
                    total={totalSpending}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No spending data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
