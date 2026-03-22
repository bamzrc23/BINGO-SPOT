export type FieldErrors = Record<string, string[] | undefined>;

export type AuthFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

export type ProfileFormDefaults = {
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  role: "user" | "admin";
  accountStatus: "pending" | "active" | "suspended";
};

export const INITIAL_AUTH_FORM_STATE: AuthFormState = {
  status: "idle"
};
