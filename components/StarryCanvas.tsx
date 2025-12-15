import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { Point, Ripple, HandResults } from '../types';
import { getLineIntersection } from '../utils/math';

// Placeholder for "Macau" or Starry Night style image
// Using a picsum seed that yields a dark, moody, textured landscape
const BACKDROP_URL = "https://picsum.photos/seed/starrynight/1920/1080";

const StarryCanvas: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State refs for animation loop
  const ripplesRef = useRef<Ripple[]>([]);
  const prevHandPosRef = useRef<Record<string, Point>>({}); // Store previous tip positions for collision
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Initialize Background Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = BACKDROP_URL;
    img.onload = () => {
      backgroundRef.current = img;
    };
  }, []);

  const spawnRipple = (x: number, y: number) => {
    ripplesRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      age: 0,
      maxAge: 60, // frames
      intensity: 1.0
    });
  };

  const onResults = useCallback((results: HandResults) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !backgroundRef.current) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw Background
    // We draw it slightly dark to make the "string" pop
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(backgroundRef.current, 0, 0, width, height);
    
    // Slight overlay to darken
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // 2. Logic: Find Hands and String
    let leftIndex: Point | null = null;
    let rightIndex: Point | null = null;
    const activePluckers: Point[] = []; // Tips of other fingers that can pluck
    
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        // MediaPipe usually doesn't strictly identify Left vs Right in simple array without `multiHandedness`
        // But we can approximate logic or just use specific landmarks.
        // For simplicity: If we have 2 hands, we take Index tip (8) of both.
        // If 1 hand, we can't make a string between two hands.
        
        // However, to distinguish L/R for the prompt "Left Index to Right Index", 
        // we can rely on `results.multiHandedness`.
        // But strictly, we just need TWO index points to draw a line.
        
        // Let's just gather all index tips and if we have >= 2, use the first two as the string anchors.
        // Gather other finger tips (Middle: 12, Ring: 16) as pluckers.
        
        const indexTip = { x: landmarks[8].x * width, y: landmarks[8].y * height };
        const middleTip = { x: landmarks[12].x * width, y: landmarks[12].y * height };
        
        if (!leftIndex) {
          leftIndex = indexTip;
        } else if (!rightIndex) {
          rightIndex = indexTip;
        }

        activePluckers.push(middleTip);
      }
    }

    // 3. Draw String & Check Collisions
    if (leftIndex && rightIndex) {
      // Draw the String
      ctx.beginPath();
      ctx.moveTo(leftIndex.x, leftIndex.y);
      ctx.lineTo(rightIndex.x, rightIndex.y);
      ctx.strokeStyle = '#ffffdd'; // Yellowish white
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f0c040'; // Glow
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset

      // Collision Detection
      // We check if any "activePlucker" moved ACROSS the line segment (leftIndex -> rightIndex)
      // compared to its previous position.
      activePluckers.forEach((plucker, i) => {
        const key = `plucker-${i}`;
        const prev = prevHandPosRef.current[key];
        
        if (prev) {
          // Check Intersection
          const intersected = getLineIntersection(
            prev, plucker, 
            leftIndex as Point, rightIndex as Point
          );

          if (intersected) {
            // PLUCK!
            // 1. Audio
            const normalizedX = plucker.x / width;
            audioService.playPluck(normalizedX);
            
            // 2. Ripple
            spawnRipple(plucker.x, plucker.y);
            
            // Visual feedback on the string
            ctx.beginPath();
            ctx.arc(plucker.x, plucker.y, 20, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
          }
        }
        
        // Update history
        prevHandPosRef.current[key] = plucker;
      });
    } else {
      // Reset history if hands lost to prevent teleport glitches
      prevHandPosRef.current = {};
    }

    // 4. Draw Ripples (Swirling Effect)
    // Simulating "Starry Night" swirls using rotating particles
    ripplesRef.current.forEach((ripple, idx) => {
      ripple.age++;
      
      const life = 1 - (ripple.age / ripple.maxAge); // 1.0 to 0.0
      if (life <= 0) {
        return; 
      }

      ctx.save();
      ctx.translate(ripple.x, ripple.y);
      const rotation = ripple.age * 0.1;
      ctx.rotate(rotation);
      
      // Draw spiral arms
      ctx.beginPath();
      ctx.globalCompositeOperation = 'overlay'; // Blend mode for "glowing" look
      ctx.strokeStyle = `rgba(255, 255, 100, ${life * 0.8})`;
      ctx.lineWidth = 3 + (1-life) * 10;
      
      // Draw a simple spiral shape
      for(let j=0; j<3; j++) {
        ctx.rotate( (Math.PI * 2) / 3 );
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.bezierCurveTo(
          30 + ripple.age * 2, 20, 
          50 + ripple.age * 4, -20, 
          80 + ripple.age * 6, 0
        );
        ctx.stroke();
      }

      ctx.restore();
    });

    // Cleanup dead ripples
    ripplesRef.current = ripplesRef.current.filter(r => r.age < r.maxAge);
    
    // Draw Tips for user feedback
    if (results.multiHandLandmarks) {
        ctx.globalCompositeOperation = 'source-over';
        for (const landmarks of results.multiHandLandmarks) {
            const x = landmarks[8].x * width;
            const y = landmarks[8].y * height;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
        }
    }

  }, []);

  // Initialize MediaPipe and Camera
  useEffect(() => {
    if (!permissionGranted) return;

    let hands: any = null; // Use any for global Hands
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const start = async () => {
      // Access Hands from global scope injected by script tag
      const HandsClass = (window as any).Hands;
      if (!HandsClass) {
        console.error("MediaPipe Hands not loaded");
        return;
      }

      hands = new HandsClass({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      hands.onResults(onResults);

      if (videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          });
          
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play();
             setIsLoaded(true);
             processVideo();
          };
        } catch (err) {
          console.error("Camera error:", err);
        }
      }
    };

    const processVideo = async () => {
      if (videoRef.current && hands) {
        if (!videoRef.current.paused && !videoRef.current.ended) {
            await hands.send({ image: videoRef.current });
        }
        animationFrameId = requestAnimationFrame(processVideo);
      }
    };

    start();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (hands) hands.close();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [permissionGranted, onResults]);

  const handleStart = async () => {
    await audioService.initialize();
    audioService.resume();
    setPermissionGranted(true);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Hidden Video Input */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
        style={{ transform: 'scaleX(-1)' }} 
      />

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block"
        style={{ transform: 'scaleX(-1)' }} // Mirror display so movement feels natural
      />

      {/* UI Overlay */}
      {!permissionGranted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center p-8 border border-white/20 rounded-xl bg-black/50 backdrop-blur-md max-w-md">
            <h1 className="text-4xl font-light text-white mb-4 tracking-widest uppercase">
              Starry String
            </h1>
            <p className="text-gray-300 mb-8 font-light leading-relaxed">
              Experience an interactive Van Gogh soundscape. 
              <br/>
              Use your index fingers to create a cosmic string.
              <br/>
              Pluck it with your middle fingers.
            </p>
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform duration-300"
            >
              Enter Experience
            </button>
            <p className="text-xs text-gray-500 mt-4">Camera access required</p>
          </div>
        </div>
      )}

      {permissionGranted && !isLoaded && (
        <div className="absolute top-4 right-4 text-white/50 text-sm animate-pulse font-mono">
          Loading Vision Model...
        </div>
      )}
    </div>
  );
};

export default StarryCanvas;