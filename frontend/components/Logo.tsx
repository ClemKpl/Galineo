'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

export default function Logo({ className = '', size = 24, style }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* 
        Pictogramme stylisé composé de 4 segments parallèles inclinés 
        pour former un "G" / "S" abstrait.
      */}
      {/* Segment haut droit */}
      <path d="M35 20 L85 20 L75 35 L25 35 Z" fill="currentColor" />
      
      {/* Segment milieu gauche */}
      <path d="M15 42 L65 42 L75 57 L25 57 Z" fill="currentColor" />
      
      {/* Segment milieu droit */}
      <path d="M35 52 L85 52 L95 67 L45 67 Z" fill="currentColor" />
      
      {/* Segment bas gauche */}
      <path d="M15 75 L65 75 L55 90 L5 90 Z" fill="currentColor" />
    </svg>
  );
}
