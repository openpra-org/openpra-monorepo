import CerealLightWoff2 from "./Cereal-Light.woff2";
import CerealBookWoff2 from "./Cereal-Book.woff2";
import CerealMediumWoff2 from "./Cereal-Medium.woff2";
import CerealBoldWoff2 from "./Cereal-Bold.woff2";
import CerealExtraBoldWoff2 from "./Cereal-Extra-Bold.woff2";
import CerealBlackWoff2 from "./Cereal-Black.woff2";

export const cerealLight = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 300,
  src: `url(${CerealLightWoff2}) format('woff2')`,
};

export const cerealBook = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 400,
  src: `url(${CerealBookWoff2}) format('woff2')`,
};

export const cerealMedium = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 500,
  src: `url(${CerealMediumWoff2}) format('woff2')`,
};

export const cerealBold = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 600,
  src: `url(${CerealBoldWoff2}) format('woff2')`,
};

export const cerealExtraBold = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 700,
  src: `url(${CerealExtraBoldWoff2}) format('woff2')`,
};

export const cerealBlack = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 800,
  src: `url(${CerealBlackWoff2}) format('woff2')`,
};

export const cerealAll = [
  cerealLight,
  cerealBook,
  cerealMedium,
  cerealBold,
  cerealExtraBold,
  cerealBlack,
];
