import React from 'react';

// We will now accept a `className` prop to merge with our base styles.
const Button = ({ children, onClick, disabled, className = '', ...props }) => {
  
  const baseClasses = `
    flex items-center justify-center gap-2 
    font-semibold py-2 px-4 rounded-md 
    bg-accent text-bg-primary shadow-shiny 
    transition-transform duration-200 
    hover:scale-[1.01] active:scale-[.98]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100
  `;
  // Combine the base classes with any classes passed in via props.
  const combinedClasses = `${baseClasses} ${className}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={combinedClasses.trim()} // Use the combined classes
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;