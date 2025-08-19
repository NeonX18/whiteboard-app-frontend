import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  text?: string;
}

export default function LoadingSpinner({
  size = "md",
  color = "#3b82f6",
  text,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} border-2 border-gray-200 dark:border-gray-700 rounded-full animate-spin transition-colors duration-300`}
          style={{
            borderTopColor: color,
            borderRightColor: color,
          }}
        />
        <div
          className={`${sizeClasses[size]} absolute inset-0 border-2 border-transparent rounded-full animate-ping`}
          style={{
            borderTopColor: color,
            opacity: 0.3,
          }}
        />
      </div>
      {text && (
        <p
          className={`text-gray-600 dark:text-gray-300 font-medium ${textSizeClasses[size]} transition-colors duration-300`}
        >
          {text}
        </p>
      )}
    </div>
  );
}

export function LoadingDots() {
  return (
    <div className="flex space-x-1">
      <div
        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      ></div>
      <div
        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      ></div>
      <div
        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      ></div>
    </div>
  );
}

export function LoadingPulse() {
  return (
    <div className="flex space-x-2">
      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse"></div>
      <div
        className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full animate-pulse"
        style={{ animationDelay: "200ms" }}
      ></div>
      <div
        className="w-3 h-3 bg-gradient-to-r from-pink-500 to-red-600 rounded-full animate-pulse"
        style={{ animationDelay: "400ms" }}
      ></div>
    </div>
  );
}
