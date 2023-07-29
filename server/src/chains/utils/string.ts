export function stringJoinArrayOrNone(uknw: string | string[] | undefined) {
  if (!uknw) {
    return "None";
  }
  if (typeof uknw === "string") {
    return uknw;
  }
  if (Array.isArray(uknw)) {
    return uknw.join("\n");
  }
}
