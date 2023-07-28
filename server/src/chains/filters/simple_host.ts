import { Email } from "../../adapters/base";

export function buildFilterFunction(allowedHosts?: (string | RegExp)[]) {
  return function filterEmailHostname(email: Email) {
    if (allowedHosts) {
      return allowedHosts.some((host) => {
        if (typeof host === "string") {
          return email.from!.text.endsWith(host);
        } else {
          return email.from!.text.match(host) !== null;
        }
      });
    }

    return true;
  };
}
