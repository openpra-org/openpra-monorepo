export const ToTitleCase = (str: string, stripDashes = true): string =>
  str
    .replace(/-/g, stripDashes ? " " : "-")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
export const TokenizePath = (path: string, stripTrailingSlash = true): string[] => {
  const str = stripTrailingSlash ? path.replace(/\/+$/, "") : path;
  return str.split("/").filter((value) => value !== "");
};
