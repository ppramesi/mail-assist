import { Email } from "../../adapters/base";

export function buildFilterFunction(allowedHosts?: string[]) {
  return function filterEmailHostname(email: Email) {
    if (allowedHosts) {
      return allowedHosts.some((host) => email.from!.text.endsWith(host));
    }

    return true;
  };
}
