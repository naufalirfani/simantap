import PropTypes from 'prop-types';

const IconButton = ({ onClick, title, variant = 'default', children, className = '', size = 'md', type = 'button', disabled = false, ...rest }) => {
  const base = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none';
  const sizes = {
    sm: 'px-2 py-1 text-md',
    md: 'px-3 py-1.5 text-md',
    lg: 'px-6 py-3 text-md',
  };
  const variants = {
    default: 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200',
    primary: 'bg-[#3B82F6] text-white hover:bg-[#296eb8] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#296eb8] focus:ring-offset-2 transition-all duration-200',
    danger: 'bg-[#d33] text-white hover:bg-[#b22] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b22] focus:ring-offset-2 transition-all duration-200',
    success: 'bg-[#28a745] text-white hover:bg-[#218838] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#218838] focus:ring-offset-2 transition-all duration-200',
    warn: 'bg-[#f39c12] text-white hover:bg-[#f39c12] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#f39c12] focus:ring-offset-2 transition-all duration-200',
    ghost: 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
  };

  const isDisabled = Boolean(disabled);

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={isDisabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.default} ${className} ${isDisabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : 'cursor-pointer hover:scale-105'}`}
      {...rest}
    >
      {children}
    </button>
  );
};

IconButton.propTypes = {
  onClick: PropTypes.func,
  title: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'primary', 'danger', 'success', 'warn', 'ghost']),
  children: PropTypes.node,
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
};

export default IconButton;
