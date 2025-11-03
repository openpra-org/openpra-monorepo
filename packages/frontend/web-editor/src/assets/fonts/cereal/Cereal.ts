import CerealLightWoff2 from "./Cereal-Light.woff2";
import CerealBookWoff2 from "./Cereal-Book.woff2";
import CerealMediumWoff2 from "./Cereal-Medium.woff2";
import CerealBoldWoff2 from "./Cereal-Bold.woff2";
import CerealExtraBoldWoff2 from "./Cereal-Extra-Bold.woff2";
import CerealBlackWoff2 from "./Cereal-Black.woff2";

/**
 * CSS font-face descriptors for all Cereal font weights used by the app.
 */
export const CerealLight = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 300,
  src: `url(${String(CerealLightWoff2)}) format('woff2')`,
};

export const CerealBook = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 400,
  src: `url(${String(CerealBookWoff2)}) format('woff2')`,
};

export const CerealMedium = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 500,
  src: `url(${String(CerealMediumWoff2)}) format('woff2')`,
};

export const CerealBold = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 600,
  src: `url(${String(CerealBoldWoff2)}) format('woff2')`,
};

export const CerealExtraBold = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 700,
  src: `url(${String(CerealExtraBoldWoff2)}) format('woff2')`,
};

export const CerealBlack = {
  fontFamily: "Cereal, sans-serif",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 800,
  src: `url(${String(CerealBlackWoff2)}) format('woff2')`,
};

export const CerealAll = [CerealLight, CerealBook, CerealMedium, CerealBold, CerealExtraBold, CerealBlack];
