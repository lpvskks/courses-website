export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegistrationRequest {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  password: string;
}
