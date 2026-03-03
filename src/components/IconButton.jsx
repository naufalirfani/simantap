import PropTypes from "prop-types";

const IconButton = ({
  onClick,
  title,
  variant = "default",
  children,
  className = "",
  size = "md",
  type = "button",
  disabled = false,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none whitespace-nowrap";
  const sizes = {
    sm: "px-2 py-1 text-md",
    md: "px-3 py-1.5 text-md",
    lg: "px-4 py-2.5 text-md",
  };
  const variants = {
    default:
      "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200",
    primary: `bg-teal-500 text-white hover:bg-teal-600 font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 transition-all duration-200`,
    blue: `bg-app-blue text-white hover:bg-app-blue-dark font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-app-blue-dark focus:ring-offset-2 transition-all duration-200`,
    danger: `bg-app-red text-white hover:bg-app-red-dark font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-app-red-dark focus:ring-offset-2 transition-all duration-200`,
    success: `bg-app-green text-white hover:bg-app-green-dark font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-app-green-dark focus:ring-offset-2 transition-all duration-200`,
    warn: `bg-app-orange text-white hover:bg-app-orange-dark font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-app-orange-dark focus:ring-offset-2 transition-all duration-200`,

    ghost:
      "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
  };

  const isDisabled = Boolean(disabled);

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={isDisabled}
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.default} ${className} ${isDisabled ? "opacity-50 cursor-not-allowed hover:scale-100" : "cursor-pointer hover:scale-105"}`}
      {...rest}
    >
      {children}
    </button>
  );
};

IconButton.propTypes = {
  onClick: PropTypes.func,
  title: PropTypes.string,
  variant: PropTypes.oneOf([
    "default",
    "primary",
    "danger",
    "success",
    "warn",
    "ghost",
  ]),
  children: PropTypes.node,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  disabled: PropTypes.bool,
};

export default IconButton;
