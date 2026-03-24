// src/utils/validation.ts – Input Validation Utilities
// ─────────────────────────────────────────────────────────────────────────────
// Provides validation and filtering functions for all input types.
// No emojis allowed except in chat inputs.

// ─── Regex Patterns ──────────────────────────────────────────────────────────

// Letters, spaces, and common punctuation (no emojis, no numbers)
const NAME_REGEX = /^[a-zA-Z\s\-'.]+$/;

// Letters, numbers, underscores, hyphens (no emojis, no spaces)
const USERNAME_REGEX = /^[a-zA-Z0-9_\-]+$/;

// Email format (standard RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// Decimal numbers only (positive, with optional decimal point)
const DECIMAL_REGEX = /^[0-9]*\.?[0-9]*$/;

// Integer numbers only (positive, no decimal point)
const INTEGER_REGEX = /^[0-9]*$/;

// No emoji characters (strips all emoji and emoji modifiers)
const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2602}-\u{2605}\u{2607}-\u{2612}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{265F}-\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267E}-\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26A7}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}-\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}]/gu;

// Letters, numbers, spaces, and basic punctuation (no emojis)
const SAFE_TEXT_REGEX = /[^\p{L}\p{N}\s.,!?;:'"\-()]/gu;

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * Validates a full name (letters, spaces, hyphens, apostrophes only)
 */
export function validateName(value: string): boolean {
  return NAME_REGEX.test(value.trim());
}

/**
 * Validates a username (letters, numbers, underscores, hyphens only)
 */
export function validateUsername(value: string): boolean {
  return USERNAME_REGEX.test(value.trim());
}

/**
 * Validates an email address
 */
export function validateEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Validates a decimal number (positive, optional decimal point)
 */
export function validateDecimal(value: string): boolean {
  if (value === '' || value === '.') return true; // Allow empty or partial input
  return DECIMAL_REGEX.test(value);
}

/**
 * Validates an integer number (positive, no decimal)
 */
export function validateInteger(value: string): boolean {
  if (value === '') return true; // Allow empty
  return INTEGER_REGEX.test(value);
}

// ─── Filter Functions (strip invalid characters) ────────────────────────────

/**
 * Removes emojis from text
 */
export function stripEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, '');
}

/**
 * Filters text to only allow letters, spaces, and basic punctuation
 * Used for names and similar fields
 */
export function filterNameInput(text: string): string {
  return stripEmojis(text).replace(/[^a-zA-Z\s\-'.]/g, '');
}

/**
 * Filters text to only allow letters, numbers, underscores, hyphens
 * Used for usernames
 */
export function filterUsernameInput(text: string): string {
  return stripEmojis(text).replace(/[^a-zA-Z0-9_\-]/g, '');
}

/**
 * Filters text to only allow decimal numbers
 * Used for numeric inputs that support decimals
 */
export function filterDecimalInput(text: string): string {
  // Remove all non-numeric characters except one decimal point
  let filtered = text.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = filtered.split('.');
  if (parts.length > 2) {
    filtered = parts[0] + '.' + parts.slice(1).join('');
  }
  
  return filtered;
}

/**
 * Filters text to only allow integer numbers
 * Used for whole number inputs
 */
export function filterIntegerInput(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/**
 * Filters text to remove only emojis, keeping all other characters
 * Used for text fields that allow most characters but no emojis
 */
export function filterNoEmoji(text: string): string {
  return stripEmojis(text);
}

/**
 * Sanitizes email input - removes emojis and spaces
 */
export function filterEmailInput(text: string): string {
  return stripEmojis(text).replace(/\s/g, '');
}

// ─── Helper: Create onChangeText handler ─────────────────────────────────────

/**
 * Creates a filtered onChangeText handler for TextInput
 * 
 * @example
 * <TextInput
 *   onChangeText={createInputHandler('name', setValue)}
 * />
 */
export type InputFilterType = 'name' | 'username' | 'email' | 'decimal' | 'integer' | 'noEmoji';

export function createInputHandler(
  filterType: InputFilterType,
  onChange: (value: string) => void
): (text: string) => void {
  return (text: string) => {
    let filtered: string;
    switch (filterType) {
      case 'name':
        filtered = filterNameInput(text);
        break;
      case 'username':
        filtered = filterUsernameInput(text);
        break;
      case 'email':
        filtered = filterEmailInput(text);
        break;
      case 'decimal':
        filtered = filterDecimalInput(text);
        break;
      case 'integer':
        filtered = filterIntegerInput(text);
        break;
      case 'noEmoji':
        filtered = filterNoEmoji(text);
        break;
      default:
        filtered = text;
    }
    onChange(filtered);
  };
}
