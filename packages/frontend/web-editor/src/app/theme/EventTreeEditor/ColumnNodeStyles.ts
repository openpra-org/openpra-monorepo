import { ColorModes, getColorsForMode } from "../ThemeMods";

export const getColumnNodeStyles = (colorMode: ColorModes) => {
  const colors = getColorsForMode(colorMode);

  if (!colors) {
    throw new Error(`Colors not defined for color mode: ${colorMode}`);
  }

  return {
    handle: {
      position: "absolute",
      top: "50%",
      left: "20%",
      visibility: "hidden",
    },
    nodeContainer: {
      borderColor: "white",
      border: "1px solid",
      padding: "4px",
      fontSize: "0.6rem",
      visibility: (hideText: boolean) => (hideText ? "hidden" : "visible"),
      color: colors.text,
    },
    nodeContent: {
      display: "flex",
      justifyContent: "center",
      textAlign: "center",
    },
    textArea: {
      textAlign: "center",
      fontSize: "0.9rem",
      background: "transparent",
      border: "none",
      overflow: "auto",
      outline: "none",
      boxShadow: "none",
      height: 46,
      padding: 4,
      scrollbarWidth: "none",
      color: colors.text,
    },
    initials: {
      fontSize: "0.8rem",
      fontWeight: "bold",
      color: colors.text,
    },
    handleSource: {
      position: "absolute",
      top: "50%",
      right: "-1%",
      visibility: "hidden",
    },
  };
};
