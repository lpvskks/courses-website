export interface UserProfileResponse {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
}

export interface UpdateUserProfileRequest {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
}