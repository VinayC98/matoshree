export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidPassword = (password: string) => password.length >= 6;
