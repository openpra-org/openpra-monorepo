/**
 @remarks Converts a string to title case. If set to true, dashes will be
  replaced with spaces; if set to false, dashes will be retained.
  Defaults to true.

 @param str - The string to convert to title case.
 @param stripDashes - Specifies whether to strip dashes from the string
 @returns The input string converted to title case.
 */
export const ToTitleCase = (str: string, stripDashes = true): string =>
  str
    .replace(/-/g, stripDashes ? " " : "-")
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

/**
 @remarks Tokenizes a path string into an array of individual path segments.

 @param path - The path string to tokenize.
 @param stripTrailingSlash - Specifies whether to strip trailing slashes from
  the path string. If set to true, trailing slashes will be removed; if set to
  false, trailing slashes will be retained. Defaults to true.
 @returns An array of individual path segments extracted from the input path string.
 */
export const TokenizePath = (path: string, stripTrailingSlash = true): string[] => {
  const str = stripTrailingSlash ? path.replace(/\/+$/, "") : path;
  return str.split("/").filter((value) => value !== "");
};
