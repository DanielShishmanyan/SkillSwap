export function authErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'functions/unauthenticated') return 'Unable to sign in. Check your details and try again.'
  if (code === 'functions/resource-exhausted') return 'Too many attempts. Wait a little before trying again.'
  if (code === 'functions/unavailable' || code === 'auth/network-request-failed') return 'Unable to connect. Please check your connection and try again.'
  if (code === 'functions/internal' || code === 'functions/unknown') return 'Sign-in is temporarily unavailable. Please try again later.'
  if (code === 'functions/invalid-argument' || code === 'functions/failed-precondition' || !code) {
    return error instanceof Error ? error.message : 'Unable to sign in. Please try again.'
  }
  return 'Unable to sign in. Please try again.'
}
