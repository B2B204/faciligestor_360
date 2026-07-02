import React, { useState } from "react";
import { BRAND } from "@/components/common/Branding";

export default function BrandLogo({ className = "", alt }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-white/25 to-white/5 ring-1 ring-white/40 shadow-lg backdrop-blur-sm shrink-0">
        <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight drop-shadow-sm">F</span>
      </div>
    );
  }

  return (
    <img
      src={BRAND.logoUrl}
      alt={alt || BRAND.name}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      draggable="false"
      onError={() => setImgError(true)}
      className={`bg-white/0 mx-1 my-1 px-1 h-8 sm:h-9 w-auto ${className}`}
      style={{
        imageRendering: "crisp-edges",
        transform: "translateZ(0)"
      }}
    />
  );
}