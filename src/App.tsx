import React, { useState, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Settings2, ArrowRightLeft, Ruler, AlertCircle, CheckCircle2, HelpCircle, Box, Maximize2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';

// Types
type FitType = 'clearance' | 'transition' | 'interference';

interface ToleranceData {
  nominal: number;
  upper: number;
  lower: number;
}

// 3D Gear Component
function Gear({ radius, holeRadius, color }: { radius: number, holeRadius: number, color: string }) {
  const gearShape = useMemo(() => {
    const shape = new THREE.Shape();
    const teeth = 24;
    const rOut = radius * 1.4;
    const rIn = radius * 1.15;
    
    for (let i = 0; i < teeth; i++) {
      const a1 = (i / teeth) * Math.PI * 2;
      const a2 = a1 + (1 / teeth) * Math.PI * 0.3;
      const a3 = a1 + (1 / teeth) * Math.PI * 0.7;
      const a4 = a1 + (1 / teeth) * Math.PI;
      
      if (i === 0) shape.moveTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
      shape.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
      shape.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
      shape.lineTo(Math.cos(a3) * rOut, Math.sin(a3) * rOut);
      shape.lineTo(Math.cos(a4) * rIn, Math.sin(a4) * rIn);
    }
    
    // Central hole
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    
    // Keyway slot in the gear hole (aligned with shaft keyway)
    const kw = 0.28; 
    const kh = 0.15;
    const keyway = new THREE.Path();
    // Positioned at the top (local +Y) so it aligns with shaft front (global +Z) after rotation [PI/2, 0, 0]
    keyway.moveTo(-kw/2, holeRadius);
    keyway.lineTo(kw/2, holeRadius);
    keyway.lineTo(kw/2, holeRadius + kh);
    keyway.lineTo(-kw/2, holeRadius + kh);
    keyway.lineTo(-kw/2, holeRadius);
    shape.holes.push(keyway);

    return shape;
  }, [radius, holeRadius]);

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[gearShape, { depth: 1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 }]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
  );
}

// 3D Stepped Shaft Component
function SteppedShaft({ radius, color, fitType }: { radius: number, color: string, fitType: FitType }) {
  const materialRef = React.useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame((state) => {
    if (materialRef.current) {
      if (fitType === 'interference') {
        // Nhấp nháy đỏ: dao động emissiveIntensity từ 0 đến 0.6
        materialRef.current.emissiveIntensity = (Math.sin(state.clock.elapsedTime * 12) + 1) * 0.3;
      } else {
        materialRef.current.emissiveIntensity = 0;
      }
    }
  });

  return (
    <group>
      {/* Main Shaft Section - Simplified and centered */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 2, 64]} />
        <meshStandardMaterial 
          ref={materialRef}
          color={color} 
          metalness={0.9} 
          roughness={0.1}
          emissive="#ff0000"
          emissiveIntensity={0}
        />
      </mesh>
      {/* Keyway Slot (Recessed) - Adjusted for shorter shaft */}
      <mesh position={[0, 0, radius - 0.05]} castShadow>
        <boxGeometry args={[0.2, 1.2, 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
}

// 3D Components
function Fitting3D({ holeRadius, shaftRadius, fitType }: { holeRadius: number, shaftRadius: number, fitType: FitType }) {
  // Exaggerate differences for visibility
  const baseRadius = 1.5;
  const scaleFactor = 10;
  
  const visualHoleRadius = baseRadius + (holeRadius - 50) * scaleFactor;
  const visualShaftRadius = baseRadius + (shaftRadius - 50) * scaleFactor;

  const holeColor = "#475569"; // Dark Slate for Gear
  const shaftColor = "#f59e0b"; // Amber/Bronze for Shaft - High contrast

  return (
    <group>
      {/* Gear with Hole: Outer size is fixed at baseRadius * 1.5, only holeRadius changes */}
      <Gear radius={baseRadius * 1.5} holeRadius={visualHoleRadius} color={holeColor} />

      {/* Shaft - Perfectly concentric and aligned */}
      <SteppedShaft radius={visualShaftRadius} color={shaftColor} fitType={fitType} />

      <ContactShadows position={[0, -3, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
    </group>
  );
}

export default function App() {
  // Shaft is fixed at 50 ± 0.02
  const shaft: ToleranceData = {
    nominal: 50,
    upper: 0.02,
    lower: -0.02,
  };

  // Hole is adjustable
  const [holeUpper, setHoleUpper] = useState<number>(0.05);
  const [holeLower, setHoleLower] = useState<number>(0.01);

  const hole: ToleranceData = {
    nominal: 50,
    upper: holeUpper,
    lower: holeLower,
  };

  // Calculations
  const shaftMax = shaft.nominal + shaft.upper;
  const shaftMin = shaft.nominal + shaft.lower;
  const holeMax = hole.nominal + hole.upper;
  const holeMin = hole.nominal + hole.lower;

  const maxClearance = holeMax - shaftMin;
  const minClearance = holeMin - shaftMax;

  const fitType = useMemo((): FitType => {
    if (holeMin >= shaftMax) return 'clearance';
    if (holeMax <= shaftMin) return 'interference';
    return 'transition';
  }, [holeMax, holeMin, shaftMax, shaftMin]);

  const fitLabel = {
    clearance: {
      title: 'Lắp Lỏng (Clearance Fit)',
      desc: 'Lỗ bánh răng luôn lớn hơn trục. Có độ hở để các chi tiết chuyển động tương đối.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />
    },
    transition: {
      title: 'Lắp Trung Gian (Transition Fit)',
      desc: 'Miền dung sai chồng lấn giữa bánh răng và trục. Có thể lỏng hoặc chặt tùy vào kích thước thực tế.',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <ArrowRightLeft className="w-6 h-6 text-amber-600" />
    },
    interference: {
      title: 'Lắp Chặt (Interference Fit)',
      desc: 'Trục luôn lớn hơn lỗ bánh răng. Cần lực ép hoặc nhiệt độ để lắp ghép, tạo liên kết cố định.',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      icon: <AlertCircle className="w-6 h-6 text-rose-600" />
    }
  }[fitType];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Mô phỏng Lắp ghép Bánh răng - Trục</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1"><Ruler className="w-4 h-4" /> D = 50 mm</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Hệ thống Lỗ/Trục</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Left Column: Compact Controls */}
        <div className="lg:col-span-3 space-y-3">
          <section className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-[10px] uppercase tracking-wider">
              <Settings2 className="w-3 h-3 text-indigo-500" />
              Thông số thiết kế
            </h2>

            <div className="space-y-4">
              {/* Gear Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">BÁNH RĂNG (GEAR)</span>
                </div>
                
                <div>
                  <div className="flex justify-between mb-0.5">
                    <label className="text-[9px] font-medium text-slate-500 uppercase">ES (Trên)</label>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">+{holeUpper.toFixed(3)}</span>
                  </div>
                  <input 
                    type="range" min="-0.1" max="0.1" step="0.001" value={holeUpper} 
                    onChange={(e) => setHoleUpper(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-0.5">
                    <label className="text-[9px] font-medium text-slate-500 uppercase">EI (Dưới)</label>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{holeLower >= 0 ? '+' : ''}{holeLower.toFixed(3)}</span>
                  </div>
                  <input 
                    type="range" min="-0.1" max="0.1" step="0.001" value={holeLower} 
                    onChange={(e) => setHoleLower(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[7px] uppercase text-slate-400 font-bold">Dmax</p>
                    <p className="text-[10px] font-mono font-bold text-slate-700">{(50 + holeUpper).toFixed(3)}</p>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[7px] uppercase text-slate-400 font-bold">Dmin</p>
                    <p className="text-[10px] font-mono font-bold text-slate-700">{(50 + holeLower).toFixed(3)}</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              {/* Shaft Info */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">TRỤC (SHAFT)</span>
                  <span className="text-[8px] text-slate-400 font-medium italic">Cố định</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[7px] uppercase text-slate-400 font-bold">dmax</p>
                    <p className="text-[10px] font-mono font-bold text-slate-700">50.020</p>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <p className="text-[7px] uppercase text-slate-400 font-bold">dmin</p>
                    <p className="text-[10px] font-mono font-bold text-slate-700">49.980</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-9 space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {/* 3D Simulation */}
            <div className="bg-[#F5F5F5] rounded-xl border border-slate-200 shadow-sm overflow-hidden relative h-[320px]">
              <div className="absolute top-2.5 left-2.5 z-10">
                <div className="bg-white/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1.5">
                  <Box className="w-2.5 h-2.5 text-indigo-600" />
                  <span className="text-[8px] font-bold text-slate-800 uppercase tracking-widest">Mô phỏng 3D</span>
                </div>
              </div>
              
              <div className="h-[320px] w-full cursor-grab active:cursor-grabbing">
                <Canvas shadows>
                  <color attach="background" args={["#F5F5F5"]} />
                  <PerspectiveCamera makeDefault position={[6, 4, 6]} fov={35} />
                  <OrbitControls enablePan={false} minDistance={4} maxDistance={12} />
                  <ambientLight intensity={0.8} />
                  <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
                  <Suspense fallback={null}>
                    <Fitting3D holeRadius={50 + (holeUpper + holeLower) / 2} shaftRadius={50} fitType={fitType} />
                    <Environment preset="studio" />
                  </Suspense>
                </Canvas>
              </div>

              <div className="absolute bottom-2.5 right-2.5 bg-white/60 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 text-slate-500 text-[7px] max-w-[140px]">
                <p className="flex items-center gap-1 mb-0.5">
                  <Maximize2 className="w-2 h-2" />
                  Xoay & Phóng to
                </p>
                <p className="italic opacity-60">* Kích thước phóng đại</p>
              </div>
            </div>

            {/* Tolerance Chart */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[320px] flex flex-col">
              <h2 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                <Info className="w-3 h-3 text-indigo-500" />
                Biểu đồ Miền Dung sai
              </h2>

              <div className="relative flex-1 w-full flex items-center justify-center">
                <div className="absolute w-full h-[1px] bg-slate-200 top-1/2 -translate-y-1/2 z-0">
                  <span className="absolute -left-1 -top-3 text-[7px] font-bold text-slate-400 uppercase tracking-widest">Đường 0</span>
                </div>

                <div className="absolute left-0 h-full flex flex-col justify-between py-2 text-[7px] font-mono text-slate-400">
                  <span>+0.100</span>
                  <span>0.000</span>
                  <span>-0.100</span>
                </div>

                <div className="flex items-end gap-8 relative z-10 w-full justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="relative w-10 h-32 flex flex-col justify-center">
                      <motion.div 
                        initial={false}
                        animate={{ 
                          height: Math.abs(holeUpper - holeLower) * 1000 * 1,
                          bottom: (holeLower * 1000 * 1) + 64
                        }}
                        className="absolute w-full bg-indigo-500/20 border-2 border-indigo-500 rounded-sm flex items-center justify-center overflow-hidden"
                      >
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 6px)', backgroundSize: '6px 6px' }} />
                        <span className="text-[7px] font-bold text-indigo-700 uppercase">Bánh răng</span>
                      </motion.div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">G</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="relative w-10 h-32 flex flex-col justify-center">
                      <motion.div 
                        initial={false}
                        animate={{ 
                          height: 0.04 * 1000 * 1,
                          bottom: (-0.02 * 1000 * 1) + 64
                        }}
                        className="absolute w-full bg-slate-500/20 border-2 border-slate-500 rounded-sm flex items-center justify-center overflow-hidden"
                      >
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, currentColor 0, currentColor 1px, transparent 0, transparent 6px)', backgroundSize: '6px 6px' }} />
                        <span className="text-[7px] font-bold text-slate-700 uppercase">Trục</span>
                      </motion.div>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">s</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Độ hở/dôi (mm)</p>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-500">Max:</span>
                    <span className="font-mono font-bold text-slate-700">{maxClearance.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-500">Min:</span>
                    <span className={`font-mono font-bold ${minClearance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{minClearance.toFixed(3)}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg flex items-center gap-1.5">
                  <Ruler className="w-2.5 h-2.5 text-indigo-500" />
                  <div>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">Dung sai lắp</p>
                    <p className="text-[10px] font-mono font-bold text-slate-800">{(maxClearance - minClearance).toFixed(3)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fit Summary Card - Moved here below simulation and chart */}
          <motion.div 
            layout
            className={`${fitLabel.bg} ${fitLabel.border} border p-4 rounded-xl shadow-sm transition-colors duration-500`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/50 rounded-lg">
                {fitLabel.icon}
              </div>
              <h3 className={`text-sm font-bold ${fitLabel.color} uppercase tracking-wide`}>{fitLabel.title}</h3>
            </div>
            <p className="text-slate-700 text-xs leading-relaxed font-medium">{fitLabel.desc}</p>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-400 text-xs border-t border-slate-200 mt-8">
        <p>© 2024 Công cụ hỗ trợ giảng dạy môn Dung sai_Lê Tuấn CK</p>
      </footer>
    </div>
  );
}
