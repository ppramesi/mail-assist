import { Email } from "../../adapters/base.js";

export function buildFilterFunction(allowedHosts?: (string | RegExp)[]) {
  const emailRegex = /<([^>]+)>/;
  return function filterEmailHostname(email: Email) {
    if (allowedHosts) {
      return allowedHosts.some((host) => {
        const emails = email
          .from!.map((v) => emailRegex.exec(v))
          .map((v) => (v ? v[1] : ""));
        if (typeof host === "string") {
          return emails.some((email) => email.endsWith(host));
        } else {
          return emails.some((email) => email.match(host) !== null);
        }
      });
    }

    return true;
  };
}
