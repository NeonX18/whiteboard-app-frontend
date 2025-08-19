"use client";

import { useState, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";

interface WhiteboardCanvasProps {
  socket: Socket;
  roomId: string;
}

interface LineData {
  points: number[];
  tool: string;
  color: string;
  lineWidth: number;
}

interface ShapeData {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tool: string;
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface User {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  isActive: boolean;
  lastSeen: number;
}

export default function WhiteboardCanvas({
  socket,
  roomId,
}: WhiteboardCanvasProps) {
  const [lines, setLines] = useState<LineData[]>([]);
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("pen");
  const [selectedColor, setSelectedColor] = useState<string>("#000000");
  const [selectedLineWidth, setSelectedLineWidth] = useState<number>(2);
  const [history, setHistory] = useState<
    { lines: LineData[]; shapes: ShapeData[] }[]
  >([{ lines: [], shapes: [] }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(true); // Start as connected to avoid immediate "disconnected" state
  const [isDarkMode, setIsDarkMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);

  // Handle resizing
  useEffect(() => {
    const resizeCanvas = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

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
        toggleDarkMode();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Toggle dark mode function
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Initialize current user
  useEffect(() => {
    // Try to get existing user from localStorage
    const existingUser = localStorage.getItem(`whiteboard_user_${roomId}`);
    let newUser: User;

    if (existingUser) {
      // Use existing user data
      newUser = JSON.parse(existingUser);
      console.log("🔄 Reconnecting with existing user:", newUser);
    } else {
      // Create new user
      const userId = Math.random().toString(36).substr(2, 9);
      const userColors = [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E9",
        "#F39C12",
        "#E74C3C",
        "#9B59B6",
        "#3498DB",
        "#1ABC9C",
      ];
      const randomColor =
        userColors[Math.floor(Math.random() * userColors.length)];

      newUser = {
        id: userId,
        name: `User ${userId.slice(-3)}`,
        color: randomColor,
        cursor: null,
        isActive: true,
        lastSeen: Date.now(),
      };

      // Store new user in localStorage
      localStorage.setItem(
        `whiteboard_user_${roomId}`,
        JSON.stringify(newUser)
      );
      console.log("🔄 Creating new user:", newUser);
    }

    setCurrentUser(newUser);
    setUsers((prev) => [newUser]);

    // Join room
    socket.emit("joinRoom", { roomId, user: newUser });
  }, [socket, roomId]);

  // Update cursor position
  useEffect(() => {
    if (!currentUser) return;

    const updateCursor = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const worldPos = screenToWorld(screenPos.x, screenPos.y);

      setCurrentUser((prev) => (prev ? { ...prev, cursor: worldPos } : null));
      socket.emit("cursorMove", {
        roomId,
        userId: currentUser.id,
        cursor: worldPos,
      });
    };

    document.addEventListener("mousemove", updateCursor);

    // Periodic update to keep user active
    const interval = setInterval(() => {
      if (currentUser && currentUser.cursor) {
        socket.emit("cursorMove", {
          roomId,
          userId: currentUser.id,
          cursor: currentUser.cursor,
        });
      }
    }, 5000); // Update every 5 seconds

    return () => {
      document.removeEventListener("mousemove", updateCursor);
      clearInterval(interval);
    };
  }, [currentUser, socket, roomId, viewport]);

  // Cleanup user on unmount
  useEffect(() => {
    return () => {
      if (currentUser) {
        socket.emit("leaveRoom", { roomId, userId: currentUser.id });
        // Remove user from localStorage when actually leaving
        localStorage.removeItem(`whiteboard_user_${roomId}`);
      }
    };
  }, [currentUser, socket, roomId]);

  // Clean up inactive users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      setUsers((prev) => prev.filter((user) => now - user.lastSeen < timeout));
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (context) {
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = selectedColor;
      context.lineWidth = selectedLineWidth;
      contextRef.current = context;
    }
  }, [dimensions, selectedColor, selectedLineWidth]);

  // Update canvas context when color or width changes
  useEffect(() => {
    const context = contextRef.current;
    if (context) {
      context.strokeStyle = selectedColor;
      context.lineWidth = selectedLineWidth;
    }
  }, [selectedColor, selectedLineWidth]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - viewport.x) / viewport.scale,
      y: (screenY - viewport.y) / viewport.scale,
    };
  };

  // Convert world coordinates to screen coordinates
  const worldToScreen = (worldX: number, worldY: number) => {
    return {
      x: worldX * viewport.scale + viewport.x,
      y: worldY * viewport.scale + viewport.y,
    };
  };

  // Redraw function with viewport transformation
  const redraw = () => {
    const context = contextRef.current;
    if (!context) return;

    context.save();

    // Set canvas background based on dark mode
    if (isDarkMode) {
      context.fillStyle = "#111827"; // Dark gray background
      context.fillRect(0, 0, dimensions.width, dimensions.height);
    } else {
      context.fillStyle = "#f9fafb"; // Light gray background
      context.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    // Apply viewport transformation only to the canvas content
    context.translate(viewport.x, viewport.y);
    context.scale(viewport.scale, viewport.scale);

    // Draw grid pattern for infinite canvas feel
    drawGrid(context);

    // Draw lines
    lines.forEach((line) => {
      if (!line || !line.points || line.points.length < 2) return;
      context.strokeStyle = line.color || "#000000";
      context.lineWidth = line.lineWidth || 2;
      context.beginPath();
      context.moveTo(line.points[0], line.points[1]);
      for (let i = 2; i < line.points.length; i += 2) {
        context.lineTo(line.points[i], line.points[i + 1]);
      }
      context.stroke();
    });

    // Draw shapes
    shapes.forEach((shape) => {
      if (!shape || !shape.type) return;
      context.strokeStyle = selectedColor;
      context.lineWidth = selectedLineWidth;
      if (shape.type === "rectangle") {
        context.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === "circle") {
        const radius = Math.sqrt(
          shape.width * shape.width + shape.height * shape.height
        );
        context.beginPath();
        context.arc(shape.x, shape.y, radius, 0, 2 * Math.PI);
        context.stroke();
      }
    });

    // Draw user cursors
    users.forEach((user) => {
      if (user.cursor && user.isActive && user.id !== currentUser?.id) {
        drawUserCursor(context, user);
      }
    });

    context.restore();
  };

  // Draw user cursor
  const drawUserCursor = (context: CanvasRenderingContext2D, user: User) => {
    if (!user.cursor) return;

    const screenPos = worldToScreen(user.cursor.x, user.cursor.y);

    context.save();
    context.translate(viewport.x, viewport.y);
    context.scale(viewport.scale, viewport.scale);

    // Draw cursor dot with user's color
    context.fillStyle = user.color;
    context.beginPath();
    context.arc(user.cursor.x, user.cursor.y, 8, 0, 2 * Math.PI);
    context.fill();

    // Draw cursor border with white outline
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = 3;
    context.stroke();

    // Draw inner dot for better visibility
    context.fillStyle = "#FFFFFF";
    context.beginPath();
    context.arc(user.cursor.x, user.cursor.y, 3, 0, 2 * Math.PI);
    context.fill();

    // Draw user name label with background
    const text = user.name;
    context.font = "bold 14px Arial";
    context.textAlign = "center";

    // Measure text for background
    const textMetrics = context.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = 16;

    // Draw background rectangle
    context.fillStyle = user.color;
    context.fillRect(
      user.cursor.x - textWidth / 2 - 4,
      user.cursor.y - 25 - textHeight / 2,
      textWidth + 8,
      textHeight + 4
    );

    // Draw text
    context.fillStyle = "#FFFFFF";
    context.fillText(text, user.cursor.x, user.cursor.y - 20);

    context.restore();
  };

  // Draw grid pattern
  const drawGrid = (context: CanvasRenderingContext2D) => {
    const gridSize = 50;
    const alpha = isDarkMode ? 0.15 : 0.1;
    const gridColor = isDarkMode ? "#ffffff" : "#000000";

    context.strokeStyle = `rgba(${
      isDarkMode ? "255, 255, 255" : "0, 0, 0"
    }, ${alpha})`;
    context.lineWidth = 1;

    const startX =
      Math.floor(-viewport.x / viewport.scale / gridSize) * gridSize;
    const endX =
      Math.ceil((-viewport.x + dimensions.width) / viewport.scale / gridSize) *
      gridSize;
    const startY =
      Math.floor(-viewport.y / viewport.scale / gridSize) * gridSize;
    const endY =
      Math.ceil((-viewport.y + dimensions.height) / viewport.scale / gridSize) *
      gridSize;

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      context.beginPath();
      context.moveTo(x, startY);
      context.lineTo(x, endY);
      context.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      context.beginPath();
      context.moveTo(startX, y);
      context.lineTo(endX, y);
      context.stroke();
    }
  };

  // Redraw whenever lines, shapes, color, width, or viewport changes
  useEffect(() => {
    redraw();
  }, [
    lines,
    shapes,
    selectedColor,
    selectedLineWidth,
    dimensions.width,
    dimensions.height,
    viewport,
    users,
  ]);

  // Listen for board events
  useEffect(() => {
    // Set initial connection state based on socket
    setIsConnected(socket.connected);

    // Connection status
    socket.on("connect", () => {
      console.log("🔗 Connected to server");
      setIsConnected(true);

      // If we have a current user, rejoin the room
      if (currentUser) {
        console.log("🔄 Rejoining room after reconnection");
        socket.emit("joinRoom", { roomId, user: currentUser });
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      // Don't immediately set disconnected - give it a moment to reconnect
      setTimeout(() => {
        if (!socket.connected) {
          setIsConnected(false);
        }
      }, 1000);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Connection error:", error);
      setIsConnected(false);
    });

    type LoadBoardData =
      | LineData[]
      | { lines?: LineData[]; shapes?: ShapeData[] };
    socket.on("loadBoard", (data: LoadBoardData) => {
      if (Array.isArray(data)) {
        setLines(data);
        setShapes([]);
        setHistory([
          { lines: [], shapes: [] },
          { lines: data, shapes: [] },
        ]);
        setHistoryIndex(1);
      } else {
        const newLines = (data.lines || []) as LineData[];
        const newShapes = (data.shapes || []) as ShapeData[];
        setLines(newLines);
        setShapes(newShapes);
        setHistory([
          { lines: [], shapes: [] },
          { lines: newLines, shapes: newShapes },
        ]);
        setHistoryIndex(1);
      }
    });

    type DrawEnvelope = { roomId?: string; strokeData: LineData | ShapeData };
    type DrawData = DrawEnvelope | LineData | ShapeData;
    socket.on("draw", (data: DrawData) => {
      const payload = (data as DrawEnvelope).strokeData
        ? (data as DrawEnvelope).strokeData
        : (data as LineData | ShapeData);
      if ((payload as LineData).points) {
        setLines((prev) => [...prev, payload as LineData]);
      } else if (
        (payload as ShapeData).type === "rectangle" ||
        (payload as ShapeData).type === "circle"
      ) {
        setShapes((prev) => [...prev, payload as ShapeData]);
      }
    });

    socket.on("clearBoard", () => {
      setLines([]);
      setShapes([]);
      setHistory([{ lines: [], shapes: [] }]);
      setHistoryIndex(0);
    });

    socket.on("updateBoard", ({ lines: newLines, shapes: newShapes }) => {
      setLines(newLines);
      setShapes(newShapes);
    });

    // User management events
    socket.on("userJoined", (user: User) => {
      console.log("👋 User joined:", user);
      setUsers((prev) => {
        const existing = prev.find((u) => u.id === user.id);
        if (existing) {
          // Update existing user
          return prev.map((u) =>
            u.id === user.id ? { ...u, ...user, isActive: true } : u
          );
        }
        return [...prev, { ...user, isActive: true }];
      });
    });

    socket.on("userLeft", (userId: string) => {
      console.log("👋 User left:", userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on("cursorUpdate", ({ userId, cursor }) => {
      console.log("📍 Cursor update:", userId, cursor);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, cursor, lastSeen: Date.now(), isActive: true }
            : u
        )
      );
    });

    socket.on("userList", (userList: User[]) => {
      console.log("📋 Received user list:", userList);
      setUsers(userList.map((user) => ({ ...user, isActive: true })));
    });

    return () => {
      socket.off("loadBoard");
      socket.off("draw");
      socket.off("clearBoard");
      socket.off("updateBoard");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("cursorUpdate");
      socket.off("userList");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, [socket]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    return screenToWorld(screenPos.x, screenPos.y);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) return; // Middle or right click

    if (e.button === 0) {
      // Left click
      if (selectedTool === "pan") {
        // Panning tool selected
        setIsPanning(true);
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Normal drawing
      isDrawingRef.current = true;
      setIsDrawing(true);
      const pos = getMousePos(e);
      startPos.current = pos;

      if (selectedTool === "pen") {
        setLines((prev) => [
          ...prev,
          {
            points: [pos.x, pos.y],
            tool: "pen",
            color: selectedColor,
            lineWidth: selectedLineWidth,
          },
        ]);
      } else if (selectedTool === "eraser") {
        eraseAtPoint(pos.x, pos.y);
      } else if (selectedTool === "rectangle" || selectedTool === "circle") {
        const newShape: ShapeData = {
          type: selectedTool,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          tool: selectedTool,
        };
        setShapes((prev) => [...prev, newShape]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && lastPanPos.current) {
      // Panning
      const deltaX = e.clientX - lastPanPos.current.x;
      const deltaY = e.clientY - lastPanPos.current.y;
      setViewport((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDrawingRef.current || !startPos.current) return;
    const pos = getMousePos(e);

    if (selectedTool === "pen") {
      setLines((prev) => {
        const lastLine = prev[prev.length - 1];
        if (!lastLine || !lastLine.points) return prev;
        const updatedLine = {
          ...lastLine,
          points: [...lastLine.points, pos.x, pos.y],
        };
        return [...prev.slice(0, -1), updatedLine];
      });
    } else if (selectedTool === "eraser") {
      eraseAtPoint(pos.x, pos.y);
    } else if (selectedTool === "rectangle" || selectedTool === "circle") {
      setShapes((prev) => {
        if (prev.length === 0) return prev;
        const lastShape = prev[prev.length - 1];
        const updatedShape = {
          ...lastShape,
          width: pos.x - startPos.current!.x,
          height: pos.y - startPos.current!.y,
        };
        return [...prev.slice(0, -1), updatedShape];
      });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      lastPanPos.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);

    if (selectedTool === "pen") {
      const lastStroke = lines[lines.length - 1];
      if (lastStroke && lastStroke.points && lastStroke.points.length > 0) {
        socket.emit("draw", { roomId, strokeData: lastStroke });
        addToHistory(lines, shapes);
      }
    } else if (selectedTool === "rectangle" || selectedTool === "circle") {
      const lastShape = shapes[shapes.length - 1];
      if (lastShape) {
        socket.emit("draw", { roomId, strokeData: lastShape });
        addToHistory(lines, shapes);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const delta = e.deltaY > 0 ? 1 - zoomFactor : 1 + zoomFactor;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((prev) => {
      const newScale = Math.max(0.1, Math.min(5, prev.scale * delta));
      const scaleRatio = newScale / prev.scale;

      return {
        x: mouseX - (mouseX - prev.x) * scaleRatio,
        y: mouseY - (mouseY - prev.y) * scaleRatio,
        scale: newScale,
      };
    });
  };

  const resetView = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  const addToHistory = (newLines: LineData[], newShapes: ShapeData[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ lines: newLines, shapes: newShapes });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setLines(previousState.lines);
      setShapes(previousState.shapes);
      setHistoryIndex(newIndex);
      socket.emit("updateBoard", {
        roomId,
        lines: previousState.lines,
        shapes: previousState.shapes,
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setLines(nextState.lines);
      setShapes(nextState.shapes);
      setHistoryIndex(newIndex);
      socket.emit("updateBoard", {
        roomId,
        lines: nextState.lines,
        shapes: nextState.shapes,
      });
    }
  };

  const clearCanvas = () => {
    setLines([]);
    setShapes([]);
    setHistory([{ lines: [], shapes: [] }]);
    setHistoryIndex(0);
    socket.emit("clearBoard", { roomId });
  };

  const eraseAtPoint = (x: number, y: number) => {
    const eraserRadius = 12 / viewport.scale;
    let hasChanges = false;
    const newLines: LineData[] = [];

    lines.forEach((line) => {
      if (!line.points || line.points.length < 4) {
        newLines.push(line);
        return;
      }

      const segments: number[][] = [];
      let currentSegment: number[] = [];
      let isInEraser = false;

      for (let i = 0; i < line.points.length; i += 2) {
        const pointX = line.points[i];
        const pointY = line.points[i + 1];
        const distance = Math.sqrt((pointX - x) ** 2 + (pointY - y) ** 2);
        const wasInEraser = isInEraser;
        isInEraser = distance <= eraserRadius;

        if (!isInEraser) {
          if (wasInEraser) {
            if (currentSegment.length > 0) {
              segments.push([...currentSegment]);
              currentSegment = [];
            }
          }
          currentSegment.push(pointX, pointY);
        } else {
          if (!wasInEraser && currentSegment.length > 0) {
            segments.push([...currentSegment]);
            currentSegment = [];
          }
          hasChanges = true;
        }
      }

      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      segments.forEach((segment) => {
        if (segment.length >= 4) {
          newLines.push({
            points: segment,
            tool: line.tool,
            color: line.color,
            lineWidth: line.lineWidth,
          });
        }
      });
    });

    const newShapes = shapes.filter((shape) => {
      if (shape.type === "rectangle") {
        const isTouching =
          x >= shape.x - eraserRadius &&
          x <= shape.x + shape.width + eraserRadius &&
          y >= shape.y - eraserRadius &&
          y <= shape.y + shape.height + eraserRadius;

        if (isTouching) {
          hasChanges = true;
          return false;
        }
      } else if (shape.type === "circle") {
        const radius = Math.sqrt(shape.width ** 2 + shape.height ** 2);
        const distance = Math.sqrt((shape.x - x) ** 2 + (shape.y - y) ** 2);

        if (distance <= radius + eraserRadius) {
          hasChanges = true;
          return false;
        }
      }
      return true;
    });

    if (hasChanges) {
      setLines(newLines);
      setShapes(newShapes);
      addToHistory(newLines, newShapes);
      socket.emit("updateBoard", {
        roomId,
        lines: newLines,
        shapes: newShapes,
      });
    }
  };

  const tools = [
    {
      id: "pen",
      label: "Pen",
      icon: (
        <svg
          className="w-4 h-4"
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
      ),
      description: "Freehand drawing",
    },
    {
      id: "eraser",
      label: "Eraser",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      description: "Remove content",
    },
    {
      id: "rectangle",
      label: "Rectangle",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      ),
      description: "Draw rectangles",
    },
    {
      id: "circle",
      label: "Circle",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      description: "Draw circles",
    },
    {
      id: "pan",
      label: "Pan",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      ),
      description: "Pan the canvas",
    },
  ];

  const colors = [
    "#000000",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
    "#008000",
    "#FFC0CB",
    "#A52A2A",
    "#808080",
    "#FFFFFF",
  ];

  const lineWidths = [1, 2, 3, 5, 8, 12, 16, 20];

  return (
    <div
      className={`relative h-full overflow-hidden transition-colors duration-300 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
      style={{
        backgroundImage: isDarkMode
          ? "radial-gradient(circle at 25% 25%, rgba(75, 85, 99, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(75, 85, 99, 0.1) 0%, transparent 50%)"
          : "radial-gradient(circle at 25% 25%, rgba(156, 163, 175, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(156, 163, 175, 0.1) 0%, transparent 50%)",
      }}
    >
      {/* Left Toolbar - Fixed positioning, not affected by canvas zoom */}
      <div className="fixed left-2 top-2 z-20 space-y-3 max-h-[calc(100vh-1rem)] overflow-y-auto">
        {/* Main Tools Section */}
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border p-4 min-w-[5rem] transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <div
            className={`text-xs font-bold mb-4 text-center transition-colors duration-300 ${
              isDarkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            🎨 Tools
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tools.slice(0, 4).map((tool) => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm transition-all duration-200 relative group ${
                  selectedTool === tool.id
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105 ring-2 ring-blue-300"
                    : isDarkMode
                    ? "bg-gray-700/90 text-gray-200 hover:bg-gray-600/90 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-gray-500/50"
                    : "bg-gray-50/90 text-gray-700 hover:bg-gray-100/90 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-gray-300/50"
                }`}
                title={`${tool.label}: ${tool.description}`}
              >
                {tool.icon}
                {selectedTool === tool.id && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow-lg"></div>
                )}
              </button>
            ))}
          </div>

          {/* Pan tool in separate row */}
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setSelectedTool("pan")}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm transition-all duration-200 relative group ${
                selectedTool === "pan"
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105 ring-2 ring-blue-300"
                  : isDarkMode
                  ? "bg-gray-700/90 text-gray-200 hover:bg-gray-600/90 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-gray-500/50"
                  : "bg-gray-50/90 text-gray-700 hover:bg-gray-100/90 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-gray-300/50"
              }`}
              title="Pan: Move the canvas around"
            >
              {tools[4].icon}
              {selectedTool === "pan" && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow-lg"></div>
              )}
            </button>
          </div>
        </div>

        {/* Color Picker - Enhanced */}
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border p-4 min-w-[5rem] transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <div
            className={`text-xs font-bold mb-4 text-center transition-colors duration-300 ${
              isDarkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            🎨 Colors
          </div>
          {/* Current Color Indicator */}
          <div
            className={`mb-4 p-3 rounded-xl text-center transition-colors duration-300 ${
              isDarkMode ? "bg-gray-700/90" : "bg-gray-50/90"
            }`}
          >
            <div
              className={`text-xs mb-2 transition-colors duration-300 ${
                isDarkMode ? "text-gray-200" : "text-gray-600"
              }`}
            >
              Current
            </div>
            <div
              className="w-10 h-10 rounded-xl border-2 border-gray-300 mx-auto shadow-lg"
              style={{ backgroundColor: selectedColor }}
            ></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {colors.slice(0, 9).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-7 h-7 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                  selectedColor === color
                    ? "border-blue-500 scale-110 ring-2 ring-blue-300 shadow-lg"
                    : isDarkMode
                    ? "border-gray-600 hover:border-gray-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ backgroundColor: color }}
                title={`Color: ${color}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {colors.slice(9).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-7 h-7 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                  selectedColor === color
                    ? "border-blue-500 scale-110 ring-2 ring-blue-300 shadow-lg"
                    : isDarkMode
                    ? "border-gray-600 hover:border-gray-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={{ backgroundColor: color }}
                title={`Color: ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Line Width - Enhanced */}
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border p-4 min-w-[5rem] transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <div
            className={`text-xs font-bold mb-4 text-center transition-colors duration-300 ${
              isDarkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            📏 Width
          </div>
          {/* Current Width Indicator */}
          <div
            className={`mb-4 p-3 rounded-xl text-center transition-colors duration-300 ${
              isDarkMode ? "bg-gray-700/90" : "bg-gray-50/90"
            }`}
          >
            <div
              className={`text-xs mb-2 transition-colors duration-300 ${
                isDarkMode ? "text-gray-200" : "text-gray-600"
              }`}
            >
              Current
            </div>
            <div
              className="w-10 h-3 bg-gray-600 rounded-full mx-auto shadow-lg"
              style={{ height: selectedLineWidth }}
            ></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {lineWidths.map((width) => (
              <button
                key={width}
                onClick={() => setSelectedLineWidth(width)}
                className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                  selectedLineWidth === width
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300 dark:bg-blue-900/30 shadow-lg"
                    : isDarkMode
                    ? "border-gray-600 hover:border-gray-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                title={`Width: ${width}px`}
              >
                <div
                  className="bg-gray-600 rounded-full mx-auto"
                  style={{
                    height: Math.min(width, 12),
                    width: Math.min(width, 12),
                  }}
                ></div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions - Enhanced */}
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border p-4 min-w-[5rem] transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <div
            className={`text-xs font-bold mb-4 text-center transition-colors duration-300 ${
              isDarkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            ⚡ Actions
          </div>
          <div className="space-y-3">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`w-full h-10 rounded-xl flex items-center justify-center hover:scale-105 hover:shadow-md transition-all duration-200 ${
                historyIndex <= 0
                  ? isDarkMode
                    ? "text-gray-600 cursor-not-allowed bg-gray-700/50"
                    : "text-gray-300 cursor-not-allowed bg-gray-100/50"
                  : isDarkMode
                  ? "text-gray-200 hover:bg-gray-700/90 hover:text-gray-100"
                  : "text-gray-700 hover:bg-gray-100/90 hover:text-gray-800"
              }`}
              title="Undo (Ctrl+Z)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </button>

            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`w-full h-10 rounded-xl flex items-center justify-center hover:scale-105 hover:shadow-md transition-all duration-200 ${
                historyIndex >= history.length - 1
                  ? isDarkMode
                    ? "text-gray-600 cursor-not-allowed bg-gray-700/50"
                    : "text-gray-300 cursor-not-allowed bg-gray-100/50"
                  : isDarkMode
                  ? "text-gray-200 hover:bg-gray-700/90 hover:text-gray-100"
                  : "text-gray-700 hover:bg-gray-100/90 hover:text-gray-800"
              }`}
              title="Redo (Ctrl+Y)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 000 2h2a1 1 0 002 0V9a1 1 0 00-2 0v1z"
                />
              </svg>
            </button>

            <button
              onClick={resetView}
              className={`w-full h-10 rounded-xl flex items-center justify-center hover:scale-105 hover:shadow-md transition-all duration-200 ${
                isDarkMode
                  ? "text-gray-200 hover:bg-gray-700/90"
                  : "text-gray-700 hover:bg-gray-100/90"
              }`}
              title="Reset View"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            <button
              onClick={clearCanvas}
              className={`w-full h-10 rounded-xl flex items-center justify-center hover:scale-105 hover:shadow-md transition-all duration-200 border-2 ${
                isDarkMode
                  ? "text-red-400 hover:bg-red-900/20 hover:text-red-300 border-red-700 hover:border-red-600"
                  : "text-red-600 hover:bg-red-50/90 hover:text-red-700 border-red-200 hover:border-red-300"
              }`}
              title="Clear Canvas"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Top Toolbar - Fixed positioning, not affected by canvas zoom */}
      <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-20">
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border px-4 py-2.5 flex items-center space-x-3 transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`p-2 rounded-lg transition-all duration-200 ${
              historyIndex <= 0
                ? isDarkMode
                  ? "text-gray-600 cursor-not-allowed"
                  : "text-gray-300 cursor-not-allowed"
                : isDarkMode
                ? "text-gray-300 hover:bg-gray-700/90 hover:text-gray-100 hover:scale-105"
                : "text-gray-600 hover:bg-gray-100/90 hover:text-gray-800 hover:scale-105"
            }`}
            title="Undo"
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
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>

          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className={`p-2 rounded-lg transition-all duration-200 ${
              historyIndex >= history.length - 1
                ? isDarkMode
                  ? "text-gray-600 cursor-not-allowed"
                  : "text-gray-300 cursor-not-allowed"
                : isDarkMode
                ? "text-gray-300 hover:bg-gray-700/90 hover:text-gray-100 hover:scale-105"
                : "text-gray-600 hover:bg-gray-100/90 hover:text-gray-800 hover:scale-105"
            }`}
            title="Redo"
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
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 000 2h2a1 1 0 002 0V9a1 1 0 00-2 0v1z"
              />
            </svg>
          </button>

          <div
            className={`w-px h-6 transition-colors duration-300 ${
              isDarkMode ? "bg-gray-600" : "bg-gray-200"
            }`}
          ></div>

          <div
            className={`text-xs font-medium transition-colors duration-300 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {historyIndex + 1} / {history.length}
          </div>

          <div
            className={`w-px h-6 transition-colors duration-300 ${
              isDarkMode ? "bg-gray-600" : "bg-gray-200"
            }`}
          ></div>

          <button
            onClick={clearCanvas}
            className={`p-2 rounded-lg hover:scale-105 transition-all duration-200 border ${
              isDarkMode
                ? "text-red-400 hover:bg-red-900/20 hover:text-red-300 border-red-700 hover:border-red-600"
                : "text-red-600 hover:bg-red-50/90 hover:text-red-700 border-red-200 hover:border-red-300"
            }`}
            title="Clear Canvas"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
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
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Viewport Info - Fixed positioning, not affected by canvas zoom */}
      <div className="fixed bottom-2 right-2 z-20">
        <div
          className={`backdrop-blur-md rounded-xl shadow-2xl border px-3 py-2 text-xs transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30 text-gray-200"
              : "bg-white/95 border-white/30 text-gray-600"
          }`}
        >
          <div className="font-medium">
            Zoom: {Math.round(viewport.scale * 100)}%
          </div>
          <div
            className={`transition-colors duration-300 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Pan: {Math.round(viewport.x)}, {Math.round(viewport.y)}
          </div>
        </div>
      </div>

      {/* User Info Panel - Fixed positioning, not affected by canvas zoom */}
      <div className="fixed right-2 top-2 z-20">
        <div
          className={`backdrop-blur-md rounded-2xl shadow-2xl border p-3 min-w-[11rem] max-w-[13rem] transition-colors duration-300 ${
            isDarkMode
              ? "bg-gray-800/95 border-gray-600/30"
              : "bg-white/95 border-white/30"
          }`}
        >
          <div
            className={`text-xs font-bold mb-3 text-center transition-colors duration-300 ${
              isDarkMode ? "text-gray-100" : "text-gray-800"
            }`}
          >
            Users ({users.length})
          </div>

          {/* Connection Status */}
          <div
            className={`mb-3 p-2 rounded-lg border transition-colors duration-300 ${
              isConnected
                ? isDarkMode
                  ? "bg-green-900/30 border-green-700"
                  : "bg-green-50/90 border-green-200"
                : isDarkMode
                ? "bg-yellow-900/30 border-yellow-700"
                : "bg-yellow-50/90 border-yellow-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? "bg-green-500 animate-pulse"
                    : "bg-yellow-500 animate-pulse"
                }`}
              ></div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isConnected
                    ? isDarkMode
                      ? "text-green-300"
                      : "text-green-700"
                    : isDarkMode
                    ? "text-yellow-300"
                    : "text-yellow-700"
                }`}
              >
                {isConnected ? "Connected" : "Connecting..."}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center space-x-2 p-2 rounded-lg transition-all duration-200 ${
                  user.id === currentUser?.id
                    ? isDarkMode
                      ? "bg-blue-900/30 border border-blue-700"
                      : "bg-blue-50/90 border border-blue-200"
                    : isDarkMode
                    ? "bg-gray-700/90 hover:bg-gray-600/90"
                    : "bg-gray-50/90 hover:bg-gray-100/90"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: user.color }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-medium truncate transition-colors duration-300 ${
                      isDarkMode ? "text-gray-200" : "text-gray-700"
                    }`}
                  >
                    {user.name}
                    {user.id === currentUser?.id && " (You)"}
                  </div>
                  <div
                    className={`text-xs transition-colors duration-300 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
                <div
                  className={`text-xs transition-colors duration-300 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                >
                  {user.cursor ? "📍" : ""}
                </div>
              </div>
            ))}

            {/* Leave Room Button */}
            <button
              onClick={() => {
                if (currentUser) {
                  socket.emit("leaveRoom", { roomId, userId: currentUser.id });
                  localStorage.removeItem(`whiteboard_user_${roomId}`);
                  // Reload the page to reset the session
                  window.location.reload();
                }
              }}
              className={`w-full mt-3 p-2 rounded-lg transition-all duration-200 border text-xs font-medium ${
                isDarkMode
                  ? "text-red-400 hover:bg-red-900/20 hover:text-red-300 border-red-700 hover:border-red-600"
                  : "text-red-600 hover:bg-red-50/90 hover:text-red-700 border-red-200 hover:border-red-300"
              }`}
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className={`transition-all duration-200 ${
          isPanning
            ? "cursor-grab"
            : selectedTool === "eraser"
            ? "cursor-crosshair"
            : "cursor-crosshair"
        }`}
        style={{
          cursor: isPanning
            ? "grab"
            : selectedTool === "eraser"
            ? "crosshair"
            : "crosshair",
        }}
      />
    </div>
  );
}
