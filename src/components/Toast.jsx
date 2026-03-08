import React from 'react';

export default function Toast({ message, type = 'success' }) {
  const bg = type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-surface' : 'bg-accent';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className={`${bg} text-white px-4 py-2 rounded-sm shadow-lg text-sm font-medium`}>
        {message}
      </div>
    </div>
  );
}
