export interface LoginValues {
  username: string;
  password: string;
}

export interface LoginErrors {
  username?: string;
  password?: string;
  form?: string;
}

export function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};

  if (!values.username.trim()) {
    errors.username = "Ingresa tu nombre de usuario.";
  }
  if (!values.password.trim()) {
    errors.password = "Ingresa tu contraseña.";
  }

  return errors;
}
