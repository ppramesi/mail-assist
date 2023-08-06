export function stringJoinArrayOrNone(uknw: string | string[] | undefined) {
  if (typeof uknw === "string") {
    return uknw;
  }
  if (Array.isArray(uknw)) {
    return uknw.join("\n");
  }
  return "None";
}
