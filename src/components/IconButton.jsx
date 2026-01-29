import PropTypes from 'prop-types';
import { PRIMARY_COLORS, SECONDARY_COLORS, DARK_COLORS } from '../config/colors';

const IconButton = ({ onClick, title, variant = 'default', children, className = '', size = 'md', type = 'button', disabled = false, ...rest }) => {
  const base = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none whitespace-nowrap';
  const sizes = {
    sm: 'px-2 py-1 text-md',
    md: 'px-3 py-1.5 text-md',
    lg: 'px-4 py-2.5 text-md',
  };
  const variants = {
    default: 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200',
    primary: `bg-[${PRIMARY_COLORS.blue}] text-white hover:bg-[${DARK_COLORS.blue}] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[${DARK_COLORS.blue}] focus:ring-offset-2 transition-all duration-200`,
    danger: `bg-[${PRIMARY_COLORS.red}] text-white hover:bg-[${DARK_COLORS.red}] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[${DARK_COLORS.red}] focus:ring-offset-2 transition-all duration-200`,
    success: `bg-[${PRIMARY_COLORS.green}] text-white hover:bg-[${DARK_COLORS.green}] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[${DARK_COLORS.green}] focus:ring-offset-2 transition-all duration-200`,
    warn: `bg-[${PRIMARY_COLORS.orange}] text-white hover:bg-[${DARK_COLORS.orange}] font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[${DARK_COLORS.orange}] focus:ring-offset-2 transition-all duration-200`,
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
