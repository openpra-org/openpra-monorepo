/**

 Converts a string to title case.
 @param {string} str - The string to convert to title case.
 @param {boolean} [stripDashes=true] - Specifies whether to strip dashes from the string.
 If set to true, dashes will be replaced with spaces; if set to false, dashes will be retained.
 Defaults to true.
 @returns {string} The input string converted to title case.
 */
export const toTitleCase = (str: string, stripDashes = true) =>
  str
    .replace(/-/g, stripDashes ? " " : "-")
    .replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );

/**

 Tokenizes a path string into an array of individual path segments.
 @param {string} path - The path string to tokenize.
 @param {boolean} [stripTrailingSlash=true] - Specifies whether to strip trailing slashes from the path string.
 If set to true, trailing slashes will be removed; if set to false, trailing slashes will be retained.
 Defaults to true.
 @returns {string[]} An array of individual path segments extracted from the input path string.
 */
export const tokenizePath = (
  path: string,
  stripTrailingSlash = true,
): string[] => {
  const str = stripTrailingSlash ? path.replace(/\/+$/, "") : path;
  return str.split("/").filter((value) => value !== "");
};
