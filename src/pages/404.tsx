import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">Page Not Found</p>
      <Link to="/" className="px-4 py-2 bg-primary text-white rounded-md">
        Go to Home
      </Link>
    </div>
  );
};

export default NotFoundPage;
