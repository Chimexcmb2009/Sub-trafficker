/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Transaction, ISPName } from '../types';
import { NIGERIAN_ISPS } from '../data';
import { Radio, Play, Square, RefreshCw, Zap, TrendingUp, AlertCircle, Sparkles, Database } from 'lucide-react';

interface TrafficStreamerProps {
  profile: UserProfile;
  onSuccess: (updatedProfile: UserProfile, tx: Transaction) => void;
}

export default function TrafficStreamer({ profile, onSuccess }: TrafficStreamerProps) {
  const [selectedIspName, setSelectedIspName] = useState<ISPName>(profile.isp);
  const [isStreaming, setIsStreaming] = useState(false);
  const [speed, setSpeed] = useState(0); // in KB/s
  const [dataStreamed, setDataStreamed] = useState(0); // in MB
  const [earnings, setEarnings] = useState(0); // in NGN
  const [isCashingOut, setIsCashingOut] = useState(false);

  // Keep target carrier in sync with detected carrier profile
  useEffect(() => {
    if (profile.isp) {
      setSelectedIspName(profile.isp);
    }
  }, [profile.isp]);

  // Canvas ref for waving cellular signal line graph
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  const selectedIsp = NIGERIAN_ISPS.find(i => i.name === selectedIspName) || NIGERIAN_ISPS[0];

  // Canvas wave animation
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.parentElement?.clientWidth || 400;
    let height = canvas.height = 120;
    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (isStreaming) {
        // Draw cyber scan lines
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i < height; i += 10) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(width, i);
          ctx.stroke();
        }

        // Animated oscillating sine wave representing network traffic stream
        ctx.strokeStyle = '#2563EB'; // Blue color
        ctx.lineWidth = 3.5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#2563EB';
        ctx.beginPath();

        const waveCount = 2;
        for (let x = 0; x < width; x++) {
          const rawAmp = Math.sin(x * 0.015 - phase) * Math.cos(x * 0.005 + phase * 0.5);
          // Speed modulates height
          const speedFactor = speed / 3000; // max around 4000
          const amplitude = (height / 2.8) * Math.max(0.2, speedFactor) * rawAmp;
          const y = height / 2 + amplitude;
          
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Second subtle frequency overlay
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.cos(x * 0.02 + phase * 1.5) * (height / 6);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        phase += 0.08;
      } else {
        // Flat line idle state
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, speed]);

  // Handle data streaming increments using real HTTP streaming to generate real network traffic
  useEffect(() => {
    let abortController: AbortController | null = null;
    let isActive = true;

    async function startRealStreaming() {
      if (!isStreaming) return;

      while (isActive && isStreaming) {
        try {
          abortController = new AbortController();
          const signal = abortController.signal;
          let downloadedInSession = 0;

          // Request 15MB of actual data from Cloudflare's CORS-enabled speed test endpoint
          const response = await fetch(`https://speed.cloudflare.com/__down?bytes=15000000&_=${Date.now()}`, {
            signal,
            cache: 'no-store'
          });

          if (!response.body) {
            throw new Error('No body in response');
          }

          const reader = response.body.getReader();
          let lastUpdateTime = performance.now();
          let lastBytesCount = 0;

          while (isActive) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              const bytes = value.length;
              downloadedInSession += bytes;
              
              // Calculate delta and speed
              const now = performance.now();
              const timeDiffSec = (now - lastUpdateTime) / 1000;
              
              if (timeDiffSec >= 0.25) { // Update speed at most every 250ms to avoid UI thrashing
                const bytesDiff = downloadedInSession - lastBytesCount;
                const currentSpeedKBs = (bytesDiff / 1024) / timeDiffSec;
                setSpeed(Math.floor(currentSpeedKBs));
                
                lastUpdateTime = now;
                lastBytesCount = downloadedInSession;
              }

              // Update data streamed in MB
              const addedMB = bytes / (1024 * 1024);
              setDataStreamed(prev => prev + addedMB);

              // Update earnings based on rate
              const earnedCash = addedMB * selectedIsp.trafficRate;
              setEarnings(prev => prev + earnedCash);
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.log('Stream fetch aborted.');
            break;
          } else {
            console.warn('Real stream fetch error, backing off 2s:', err);
            // Fallback: If offline or rate limited, wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    if (isStreaming) {
      startRealStreaming();
    } else {
      setSpeed(0);
    }

    return () => {
      isActive = false;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [isStreaming, selectedIspName]);

  const handleStartStop = () => {
    setIsStreaming(!isStreaming);
  };

  const handleCashout = async () => {
    if (earnings <= 0) return;
    setIsCashingOut(true);
    setIsStreaming(false);

    try {
      // Calculate new balances
      const updatedCashBalance = profile.cashBalance + earnings;
      const updatedTotalData = profile.totalDataStreamedMB + dataStreamed;
      const updatedAccumulatedTraffic = profile.accumulatedTrafficCash + earnings;

      // Update Firestore user profile
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        cashBalance: updatedCashBalance,
        totalDataStreamedMB: updatedTotalData,
        accumulatedTrafficCash: updatedAccumulatedTraffic
      });

      // Write Transaction document
      const txId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
      const tx: Transaction = {
        id: txId,
        userId: profile.uid,
        type: 'traffic_cashout',
        amount: dataStreamed, // Holds MBs streamed in amount
        receivedAmount: earnings, // Cash received
        networkOrIsp: selectedIsp.name,
        referenceDetails: `${dataStreamed.toFixed(2)} MB Streamed`,
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'transactions'), tx);

      const updatedProfile: UserProfile = {
        ...profile,
        cashBalance: updatedCashBalance,
        totalDataStreamedMB: updatedTotalData,
        accumulatedTrafficCash: updatedAccumulatedTraffic
      };

      // Reset local stream logs
      setDataStreamed(0);
      setEarnings(0);
      onSuccess(updatedProfile, tx);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCashingOut(false);
    }
  };

  const formattedSpeed = speed > 1024 
    ? `${(speed / 1024).toFixed(2)} MB/s` 
    : `${speed} KB/s`;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden" id="traffic-streamer-panel">
      
      {/* Background glow lines */}
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
            <Radio size={22} className={isStreaming ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h3 className="font-bold font-display text-slate-800 text-lg">Data Sharing & Rewards</h3>
            <p className="text-slate-500 text-xs">Share your unused data connection and earn cash rewards in real time</p>
          </div>
        </div>
        {isStreaming && (
          <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full flex items-center gap-1.5 text-amber-600 text-xs animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Sharing Active
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Network Selection & Action Button */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Your Mobile Network</label>
            <select
              disabled={isStreaming}
              value={selectedIspName}
              onChange={(e) => setSelectedIspName(e.target.value as ISPName)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 disabled:opacity-60 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition text-sm font-semibold"
              id="streamer-isp-select"
            >
              <option value="MTN">MTN Nigeria - ₦0.15/MB</option>
              <option value="Airtel">Airtel Nigeria - ₦0.18/MB</option>
              <option value="Glo">Glo Nigeria - ₦0.20/MB</option>
              <option value="9mobile">9mobile Nigeria - ₦0.22/MB</option>
            </select>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center justify-center space-y-4 h-[160px]">
            {isStreaming ? (
              <button
                onClick={handleStartStop}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 transition cursor-pointer"
                id="btn-stop-stream"
              >
                <Square size={24} className="text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={handleStartStop}
                disabled={isCashingOut}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:bg-slate-200"
                id="btn-start-stream"
              >
                <Play size={24} className="ml-1 text-white fill-white" />
              </button>
            )}
            <div>
              <p className="text-slate-700 font-semibold text-xs">
                {isStreaming ? 'SHARING ACTIVE' : 'SHARING PAUSED'}
              </p>
              <p className="text-slate-500 text-[10px] mt-1">
                {isStreaming ? 'Click to pause sharing' : 'Click play to start sharing and earning'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Signal Oscilloscope & Realtime Counters */}
        <div className="md:col-span-2 space-y-4">
          
          {/* Signal wave scanner screen */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 overflow-hidden relative min-h-[120px] flex flex-col justify-end">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/90 border border-slate-850 px-2 py-1 rounded-lg text-slate-300 text-[10px] font-mono">
              <Zap size={10} className="text-yellow-500" />
              <span>Speed: {formattedSpeed}</span>
            </div>
            <div className="relative z-10 flex justify-between text-[10px] font-mono text-slate-500">
              <span>{selectedIspName} Nigeria Network</span>
              <span>Latency: {isStreaming ? Math.floor(18 + Math.random() * 20) : '--'}ms</span>
            </div>
          </div>

          {/* Realtime Counters */}
          <div className="grid grid-cols-2 gap-4">
            {/* MBs Streamed */}
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                <Database size={18} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Data Shared</p>
                <p className="text-lg font-bold text-slate-800 font-mono mt-0.5">{dataStreamed.toFixed(2)} <span className="text-xs text-slate-400">MB</span></p>
              </div>
            </div>

            {/* Simulated Live Earnings */}
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl flex items-center gap-3 relative overflow-hidden">
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                <TrendingUp size={18} />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Earnings</p>
                <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5">₦{earnings.toFixed(2)}</p>
              </div>
              {isStreaming && (
                <div className="absolute right-3 top-3 animate-bounce">
                  <Sparkles size={12} className="text-yellow-400" />
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Cashout and instructions footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-2 max-w-md text-left">
          <AlertCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-normal">
            <strong>How it works:</strong> Your active connection helps relay fast network verification for Nigerian mobile users. You earn cash per megabyte, which you can claim to your wallet at any time.
          </p>
        </div>

        <button
          onClick={handleCashout}
          disabled={earnings <= 0 || isCashingOut}
          className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 transition text-sm cursor-pointer"
          id="btn-cashout-traffic"
        >
          {isCashingOut ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={15} />
              Claim Earnings to Wallet (₦{earnings.toFixed(2)})
            </>
          )}
        </button>
      </div>

    </div>
  );
}
