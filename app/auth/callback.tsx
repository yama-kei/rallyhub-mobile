// Re-export the v1 callback handler to handle the rallyhub://auth/callback deep link
// This is needed because mobile builds use "auth/callback" path while web uses "auth/v1/callback"
export { default } from "./v1/callback";
