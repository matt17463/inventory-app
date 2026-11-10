// Client-side UX validation; Supabase Auth remains the authority on password policy.
export function passwordProblem(value, confirmation) {
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 128) return 'Use no more than 128 characters.';
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.';
  if (value !== confirmation) return 'The passwords do not match.';
  return '';
}

export function passwordRecoveryRedirect(origin) {
  return new URL('/reset-password', origin).toString();
}
