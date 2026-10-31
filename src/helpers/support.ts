import { getApiBaseUrl } from "../api/config";

export const SUPPORT_EMAIL = "budget.planner@maciejsolutions.pl";
export const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/maciejsolutions";
export const CREATOR_NAME = "Maciej Solutions";

export function supportMailto(subject: string, body?: string) {
  const query = [`subject=${encodeURIComponent(subject)}`];
  if (body) query.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}?${query.join("&")}`;
}

export function privacyPolicyUrl() {
  return `${getApiBaseUrl()}/privacy`;
}
