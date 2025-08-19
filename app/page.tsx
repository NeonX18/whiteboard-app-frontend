"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Footer from "./components/Footer";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();

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

  const joinRoom = () => {
    if (roomId.trim()) {
      setIsJoining(true);
      setTimeout(() => {
        router.push(`/room/${roomId}`);
      }, 300);
    }
  };

  const createRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 8);
    setRoomId(randomId);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      } flex flex-col`}
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                <svg
                  className="w-10 h-10 text-white"
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
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Whiteboard
            </h1>
            <p
              className={`text-lg transition-colors duration-300 ${
                isDarkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Collaborate in real-time with your team
            </p>
          </div>

          {/* Main Form */}
          <div
            className={`rounded-2xl shadow-xl p-8 border transition-colors duration-300 ${
              isDarkMode
                ? "bg-gray-800/95 border-gray-700 backdrop-blur-md"
                : "bg-white border-gray-100"
            }`}
          >
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="roomId"
                  className={`block text-sm font-medium mb-2 transition-colors duration-300 ${
                    isDarkMode ? "text-gray-200" : "text-gray-700"
                  }`}
                >
                  Room ID
                </label>
                <div className="relative">
                  <input
                    id="roomId"
                    type="text"
                    placeholder="Enter or create a room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                        : "border-gray-300 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                  <button
                    onClick={createRandomRoom}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                      isDarkMode
                        ? "text-blue-400 hover:text-blue-300"
                        : "text-blue-600 hover:text-blue-700"
                    }`}
                  >
                    Random
                  </button>
                </div>
              </div>

              <button
                onClick={joinRoom}
                disabled={!roomId.trim() || isJoining}
                className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all duration-300 transform ${
                  !roomId.trim() || isJoining
                    ? isDarkMode
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                }`}
              >
                {isJoining ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  "Join Room"
                )}
              </button>
            </div>

            {/* Features */}
            <div
              className={`mt-8 pt-6 border-t transition-colors duration-300 ${
                isDarkMode ? "border-gray-700" : "border-gray-100"
              }`}
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors duration-300 ${
                      isDarkMode ? "bg-blue-900/50" : "bg-blue-100"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <p
                    className={`text-xs transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Real-time
                  </p>
                </div>
                <div className="space-y-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors duration-300 ${
                      isDarkMode ? "bg-purple-900/50" : "bg-purple-100"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                      />
                    </svg>
                  </div>
                  <p
                    className={`text-xs transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Collaborative
                  </p>
                </div>
                <div className="space-y-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors duration-300 ${
                      isDarkMode ? "bg-green-900/50" : "bg-green-100"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p
                    className={`text-xs transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Simple
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p
              className={`text-sm transition-colors duration-300 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Share the room ID with others to start collaborating
            </p>
          </div>
        </div>
      </div>

      {/* Dark Mode Toggle - Floating */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsDarkMode((prev) => !prev)}
          className={`p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
            isDarkMode
              ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
              : "bg-gray-500/20 text-gray-600 hover:bg-gray-500/30"
          }`}
          title={`${
            isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
          } (Ctrl/Cmd + D)`}
        >
          {isDarkMode ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      <Footer />
    </div>
  );
}
