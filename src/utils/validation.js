// ─────────────────────────────────────────────────────────────────────────────
// src/utils/validation.js  –  Input Validation Utilities
//
// Provides validation functions for all input fields across the app.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and sanitize numeric input
 * @param {string} value - Input value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum value (default: 0)
 * @param {number} options.max - Maximum value (default: Infinity)
 * @param {boolean} options.allowDecimal - Allow decimal numbers (default: false)
 * @param {boolean} options.allowNegative - Allow negative numbers (default: false)
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const validateNumber = (value, options = {}) => {
  const {
    min = 0,
    max = Infinity,
    allowDecimal = false,
    allowNegative = false,
  } = options;

  // Empty value is valid (for optional fields)
  if (value === '' || value === null || value === undefined) {
    return { isValid: true, value: '', error: null };
  }

  // Remove any non-numeric characters except decimal point and negative sign
  let sanitized = value.toString();
  
  // Allow only numbers, decimal point (if allowed), and negative sign (if allowed)
  const regex = allowDecimal
    ? (allowNegative ? /[^0-9.-]/g : /[^0-9.]/g)
    : (allowNegative ? /[^0-9-]/g : /[^0-9]/g);
  
  sanitized = sanitized.replace(regex, '');

  // Ensure only one decimal point
  if (allowDecimal) {
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
  }

  // Ensure negative sign is only at the beginning
  if (allowNegative && sanitized.includes('-')) {
    const negative = sanitized.startsWith('-');
    sanitized = sanitized.replace(/-/g, '');
    if (negative) sanitized = '-' + sanitized;
  }

  // Validate range if value is complete
  if (sanitized && sanitized !== '-' && sanitized !== '.') {
    const numValue = parseFloat(sanitized);
    
    if (isNaN(numValue)) {
      return { isValid: false, value: sanitized, error: 'Invalid number' };
    }

    if (numValue < min) {
      return { isValid: false, value: sanitized, error: `Must be at least ${min}` };
    }

    if (numValue > max) {
      return { isValid: false, value: sanitized, error: `Must be at most ${max}` };
    }
  }

  return { isValid: true, value: sanitized, error: null };
};

/**
 * Validate email address
 * @param {string} email - Email address
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { isValid: true, error: null }; // Empty is valid (optional field)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email address' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate text input with length constraints
 * @param {string} text - Input text
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum length (default: 0)
 * @param {number} options.maxLength - Maximum length (default: Infinity)
 * @param {boolean} options.required - Is field required (default: false)
 * @param {RegExp} options.pattern - Custom regex pattern
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateText = (text, options = {}) => {
  const {
    minLength = 0,
    maxLength = Infinity,
    required = false,
    pattern = null,
  } = options;

  if (!text || text.trim() === '') {
    if (required) {
      return { isValid: false, error: 'This field is required' };
    }
    return { isValid: true, error: null };
  }

  if (text.length < minLength) {
    return { isValid: false, error: `Must be at least ${minLength} characters` };
  }

  if (text.length > maxLength) {
    return { isValid: false, error: `Must be at most ${maxLength} characters` };
  }

  if (pattern && !pattern.test(text)) {
    return { isValid: false, error: 'Invalid format' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate username
 * @param {string} username - Username
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateUsername = (username) => {
  if (!username || username.trim() === '') {
    return { isValid: true, error: null }; // Empty is valid (optional field)
  }

  if (username.length < 3) {
    return { isValid: false, error: 'Must be at least 3 characters' };
  }

  if (username.length > 30) {
    return { isValid: false, error: 'Must be at most 30 characters' };
  }

  // Allow alphanumeric, underscore, and hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { isValid: false, error: 'Only letters, numbers, _ and - allowed' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate pomodoro duration (minutes)
 * @param {string} minutes - Duration in minutes
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const validatePomodoroDuration = (minutes) => {
  return validateNumber(minutes, { min: 1, max: 180, allowDecimal: false });
};

/**
 * Validate nutrition goal values
 * @param {string} value - Nutrition value
 * @param {string} type - Type of nutrition (calories, protein, carbs, fat, fiber)
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const validateNutritionGoal = (value, type) => {
  const limits = {
    calories: { min: 500, max: 10000 },
    protein: { min: 10, max: 500 },
    carbs: { min: 20, max: 1000 },
    fat: { min: 10, max: 500 },
    fiber: { min: 5, max: 200 },
  };

  const limit = limits[type] || { min: 0, max: 10000 };
  return validateNumber(value, { min: limit.min, max: limit.max, allowDecimal: true });
};

/**
 * Validate metric log value (water, caffeine, etc.)
 * @param {string} value - Metric value
 * @param {string} type - Type of metric (water, caffeine, vitamin_c, sugar)
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const validateMetricValue = (value, type) => {
  const limits = {
    water: { min: 0, max: 10000 },      // mL
    caffeine: { min: 0, max: 1000 },    // mg
    vitamin_c: { min: 0, max: 5000 },   // mg
    sugar: { min: 0, max: 1000 },       // g
    mood: { min: 1, max: 5 },           // 1-5 scale
    focus: { min: 0, max: 1440 },       // minutes (max 24 hours)
  };

  const limit = limits[type] || { min: 0, max: 100000 };
  return validateNumber(value, { min: limit.min, max: limit.max, allowDecimal: true });
};

/**
 * Validate food portion/serving input
 * @param {string} value - Portion value
 * @returns {{ isValid: boolean, value: string, error: string | null }}
 */
export const validateFoodPortion = (value) => {
  return validateNumber(value, { min: 0.1, max: 100, allowDecimal: true });
};
