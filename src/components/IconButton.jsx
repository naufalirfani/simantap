import PropTypes from 'prop-types';

const IconButton = ({ onClick, title, variant = 'default', children, className = '', size = 'md', type = 'button', disabled = false, ...rest }) => {
  const base = 'inline-flex items-center justify-center rounded-md transition-all duration-200 focus:outline-none';
  const sizes = {
    sm: 'px-2 py-1 text-md',
    md: 'px-3 py-1.5 text-md',
    lg: 'px-4 py-2 text-md',
  };
  const variants = {
    default: 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow',
    warn: 'bg-yellow-600 text-white hover:bg-yellow-700 shadow',
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
  variant: PropTypes.oneOf(['default', 'primary', 'danger', 'warn', 'ghost']),
  children: PropTypes.node,
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
};

export default IconButton;
