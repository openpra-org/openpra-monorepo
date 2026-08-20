import { type ImgHTMLAttributes, type JSX } from "react";
import descriptorAsset from "../assets/brand/logos/OpenPRA Lockup Primary Descriptor.svg";
import headerDarkAsset from "../assets/brand/logos/OpenPRA Lockup Dark.svg";
import headerLightAsset from "../assets/brand/logos/OpenPRA Lockup Primary.svg";
import markAsset from "../assets/brand/logos/OpenPRA Mark Violet.svg";
import reversedAsset from "../assets/brand/logos/OpenPRA Lockup Reversed.svg";
import smallTileAsset from "../assets/brand/logos/OpenPRA Icon Small Tile.svg";
import stackedAsset from "../assets/brand/logos/OpenPRA Lockup Stacked.svg";
import taglineDarkAsset from "../assets/brand/logos/OpenPRA Lockup Reversed Tagline.svg";
import taglineLightAsset from "../assets/brand/logos/OpenPRA Lockup Primary Tagline.svg";
import tileAsset from "../assets/brand/logos/OpenPRA Icon Tile Violet.svg";
import "./openPraBrand.css";

type OpenPraBrandVariant =
  | "header"
  | "tagline"
  | "descriptor"
  | "reversed"
  | "stacked"
  | "mark"
  | "tile"
  | "small-tile";

interface OpenPraBrandProps {
  variant?: OpenPraBrandVariant;
  className?: string;
  alt?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  surface?: "auto" | "light" | "dark";
}

const ASSETS: Record<Exclude<OpenPraBrandVariant, "header" | "tagline">, string> = {
  descriptor: descriptorAsset,
  reversed: reversedAsset,
  stacked: stackedAsset,
  mark: markAsset,
  tile: tileAsset,
  "small-tile": smallTileAsset,
};

const THEMED_ASSETS = {
  header: {
    light: headerLightAsset,
    dark: headerDarkAsset,
  },
  tagline: {
    light: taglineLightAsset,
    dark: taglineDarkAsset,
  },
} as const;

function OpenPraBrand({
  variant = "header",
  className = "",
  alt = "OpenPRA",
  loading = "eager",
  surface = "auto",
}: OpenPraBrandProps): JSX.Element {
  const classes = `openpra-brand openpra-brand--${variant} openpra-brand--surface-${surface}${className === "" ? "" : ` ${className}`}`;
  if (variant === "header" || variant === "tagline") {
    const assets = THEMED_ASSETS[variant];
    return (
      <span className={`${classes} openpra-brand--themed`}>
        <img className="openpra-brand__asset openpra-brand__asset--light" src={assets.light} alt={alt} loading={loading} />
        <img className="openpra-brand__asset openpra-brand__asset--dark" src={assets.dark} alt={alt} loading={loading} />
      </span>
    );
  }
  return (
    <span className={classes}>
      <img className="openpra-brand__asset" src={ASSETS[variant]} alt={alt} loading={loading} />
    </span>
  );
}

export { OpenPraBrand };
export type { OpenPraBrandProps, OpenPraBrandVariant };
