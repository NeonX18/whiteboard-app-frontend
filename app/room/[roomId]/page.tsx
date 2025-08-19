"use client";

import { useParams, useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { useState, useEffect } from "react";
import WhiteboardCanvas from "../../components/WhiteboardCanvas";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Toast } from "../../components/Notification";

const socket = io("http://localhost:5000");

export default function RoomPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareToast, setShowShareToast] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("whiteboard_dark_mode");
    if (savedDarkMode !== null) {
      setIsDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("whiteboard_dark_mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Keyboard shortcut for dark mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        setIsDarkMode((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      setIsConnected(true);
      // Don't emit joinRoom here - WhiteboardCanvas will handle it with user data
      setIsLoading(false);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Set a timeout to show loading state
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => {
      clearTimeout(timer);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [roomId]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${roomId}`
      );
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (!roomId) {
    return (
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        } flex items-center justify-center`}
      >
        <LoadingSpinner size="lg" text="Loading room..." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        } flex items-center justify-center`}
      >
        <LoadingSpinner size="lg" text="Connecting to room..." />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div
        className={`border-b shadow-sm transition-colors duration-300 ${
          isDarkMode
            ? "bg-gray-800/95 border-gray-700 backdrop-blur-md"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/")}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  isDarkMode
                    ? "hover:bg-gray-700 text-gray-300"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Back to Home"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
                <div>
                  <h1
                    className={`text-lg font-semibold transition-colors duration-300 ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Whiteboard
                  </h1>
                  <p
                    className={`text-sm transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Room: {roomId}
                  </p>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  } animate-pulse`}
                ></div>
                <span
                  className={`text-sm transition-colors duration-300 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                  isDarkMode
                    ? "text-yellow-500 hover:bg-yellow-900/20 hover:text-yellow-300"
                    : "text-gray-600 hover:bg-gray-100/90 hover:text-gray-800"
                }`}
                title={`${
                  isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
                } (Ctrl/Cmd + D)`}
              >
                {isDarkMode ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-lg transition-all duration-200 hover:scale-105 ${
                  isDarkMode
                    ? "border-gray-600 text-gray-200 bg-gray-700 hover:bg-gray-600 hover:border-gray-500"
                    : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                }`}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1">
        <WhiteboardCanvas socket={socket} roomId={roomId as string} />
      </div>

      {/* Share Toast Notification */}
      {showShareToast && (
        <Toast
          type="success"
          title="Room link copied!"
          message="Share this link with others to collaborate"
          duration={3000}
          onClose={() => setShowShareToast(false)}
        />
      )}
    </div>
  );
}
