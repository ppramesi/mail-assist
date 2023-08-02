import { Email } from "../../adapters/base.js";
import { AllowedHost } from "../../databases/base.js";

export function buildFilterFunction(allowedHosts?: AllowedHost[]) {
  const emailRegex = /<([^>]+)>/;
  return function filterEmailHostname(email: Email) {
    if (allowedHosts) {
      return allowedHosts.some((host) => {
        const emails = email
          .from!.map((v) => emailRegex.exec(v))
          .map((v) => (v ? v[1] : ""));
        if (typeof host.type === "string") {
          return emails.some((email) => email.endsWith(host.host));
        } else {
          const regex = new RegExp(host.host)
          return emails.some((email) => email.match(regex) !== null);
        }
      });
    }

    return true;
  };
}
